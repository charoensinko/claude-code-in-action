import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

// Router mock — shared instance so we can assert on push across the hook.
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: a successful auth with no anon work and no existing projects.
  mockSignIn.mockResolvedValue({ success: true });
  mockSignUp.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAuth", () => {
  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());

    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(result.current.isLoading).toBe(false);
  });

  describe("signIn", () => {
    test("calls the signIn action with email and password", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
    });

    test("returns the result from the signIn action", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAuth());

      let returned: unknown;
      await act(async () => {
        returned = await result.current.signIn("user@example.com", "password123");
      });

      expect(returned).toEqual({ success: true });
    });

    test("returns the failure result and does not navigate on failed sign in", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
      const { result } = renderHook(() => useAuth());

      let returned: unknown;
      await act(async () => {
        returned = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returned).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("runs post-sign-in flow when sign in succeeds", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      // No anon work + no projects → creates a new project and navigates.
      expect(mockCreateProject).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/new-project-id");
    });
  });

  describe("signUp", () => {
    test("calls the signUp action with email and password", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123");
    });

    test("returns the result from the signUp action", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAuth());

      let returned: unknown;
      await act(async () => {
        returned = await result.current.signUp("new@example.com", "password123");
      });

      expect(returned).toEqual({ success: true });
    });

    test("returns the failure result and does not navigate on failed sign up", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
      const { result } = renderHook(() => useAuth());

      let returned: unknown;
      await act(async () => {
        returned = await result.current.signUp("taken@example.com", "password123");
      });

      expect(returned).toEqual({ success: false, error: "Email already registered" });
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("runs post-sign-in flow when sign up succeeds", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/new-project-id");
    });
  });

  describe("handlePostSignIn — anonymous work exists", () => {
    test("creates a project from anon work and navigates to it", async () => {
      const anonMessages = [{ role: "user", content: "build a button" }];
      const anonFileSystem = { "/App.jsx": { type: "file", content: "x" } };
      mockGetAnonWorkData.mockReturnValue({
        messages: anonMessages,
        fileSystemData: anonFileSystem,
      });
      mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: anonMessages,
        data: anonFileSystem,
      });
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      // Should short-circuit before checking existing projects.
      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    test("ignores anon work when it has no messages and falls through", async () => {
      mockGetAnonWorkData.mockReturnValue({
        messages: [],
        fileSystemData: { "/App.jsx": { type: "file", content: "x" } },
      });
      mockGetProjects.mockResolvedValue([{ id: "existing-1" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockGetProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-1");
    });
  });

  describe("handlePostSignIn — no anon work", () => {
    test("navigates to the most recent existing project", async () => {
      mockGetProjects.mockResolvedValue([
        { id: "recent-project" },
        { id: "older-project" },
      ] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent-project");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    test("creates a new project when the user has none", async () => {
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "fresh-project" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringContaining("New Design #"),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/fresh-project");
    });
  });

  describe("isLoading", () => {
    test("is true while signing in and false after completion", async () => {
      let resolveSignIn: (value: { success: boolean }) => void;
      mockSignIn.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<unknown>;
      act(() => {
        signInPromise = result.current.signIn("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn!({ success: false });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when the action throws", async () => {
      mockSignIn.mockRejectedValue(new Error("network down"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(
          result.current.signIn("user@example.com", "password123")
        ).rejects.toThrow("network down");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false when post-sign-in flow throws", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockCreateProject.mockRejectedValue(new Error("db error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(
          result.current.signIn("user@example.com", "password123")
        ).rejects.toThrow("db error");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("toggles isLoading during signUp as well", async () => {
      let resolveSignUp: (value: { success: boolean }) => void;
      mockSignUp.mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<unknown>;
      act(() => {
        signUpPromise = result.current.signUp("new@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp!({ success: false });
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
