// @vitest-environment node
import { describe, test, expect, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";

// In-memory cookie store shared by the mocked `next/headers` cookie jar.
interface StoredCookie {
  value: string;
  options?: Record<string, unknown>;
}
let cookieStore: Map<string, StoredCookie>;

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const entry = cookieStore.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieStore.set(name, { value, options });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  })),
}));

import { createSession, getSession } from "@/lib/auth";

const COOKIE_NAME = "auth-token";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

beforeEach(() => {
  cookieStore = new Map();
});

describe("createSession", () => {
  test("sets an auth-token cookie", async () => {
    await createSession("user-1", "user@example.com");

    const cookie = cookieStore.get(COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBeTruthy();
  });

  test("sets the cookie with secure httpOnly options", async () => {
    await createSession("user-1", "user@example.com");

    const options = cookieStore.get(COOKIE_NAME)?.options;
    expect(options?.httpOnly).toBe(true);
    expect(options?.sameSite).toBe("lax");
    expect(options?.path).toBe("/");
    // secure is gated on production; the test env is not production.
    expect(options?.secure).toBe(false);
  });

  test("sets cookie expiry roughly 7 days out", async () => {
    const before = Date.now();
    await createSession("user-1", "user@example.com");
    const after = Date.now();

    const expires = cookieStore.get(COOKIE_NAME)?.options?.expires as Date;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expires).toBeInstanceOf(Date);
    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDays + 1000);
  });

  test("issues a token whose payload carries userId and email", async () => {
    await createSession("user-42", "alice@example.com");

    const session = await getSession();
    expect(session?.userId).toBe("user-42");
    expect(session?.email).toBe("alice@example.com");
  });

  test("overwrites any previously set session cookie", async () => {
    await createSession("user-1", "first@example.com");
    const firstToken = cookieStore.get(COOKIE_NAME)?.value;

    await createSession("user-2", "second@example.com");
    const secondToken = cookieStore.get(COOKIE_NAME)?.value;

    expect(secondToken).not.toBe(firstToken);
    const session = await getSession();
    expect(session?.userId).toBe("user-2");
    expect(session?.email).toBe("second@example.com");
  });
});

describe("getSession", () => {
  test("returns the session for a valid token", async () => {
    await createSession("user-7", "bob@example.com");

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-7");
    expect(session?.email).toBe("bob@example.com");
  });

  test("returns null when no auth-token cookie is present", async () => {
    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for a token signed with a different secret", async () => {
    const badToken = await new SignJWT({
      userId: "user-1",
      email: "user@example.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(new TextEncoder().encode("a-different-secret"));
    cookieStore.set(COOKIE_NAME, { value: badToken });

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    cookieStore.set(COOKIE_NAME, { value: "not-a-jwt" });

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const expiredToken = await new SignJWT({
      userId: "user-1",
      email: "user@example.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("-1h")
      .setIssuedAt()
      .sign(JWT_SECRET);
    cookieStore.set(COOKIE_NAME, { value: expiredToken });

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns the payload carrying userId and email", async () => {
    const token = await new SignJWT({
      userId: "user-99",
      email: "eve@example.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(JWT_SECRET);
    cookieStore.set(COOKIE_NAME, { value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-99");
    expect(session?.email).toBe("eve@example.com");
  });
});
