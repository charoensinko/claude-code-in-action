import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocation, getToolCallLabel } from "../ToolInvocation";

afterEach(() => {
  cleanup();
});

// getToolCallLabel — str_replace_editor

test("create command shows 'Creating <file>'", () => {
  expect(
    getToolCallLabel("str_replace_editor", {
      command: "create",
      path: "/components/Card.jsx",
    })
  ).toBe("Creating Card.jsx");
});

test("str_replace and insert commands show 'Editing <file>'", () => {
  expect(
    getToolCallLabel("str_replace_editor", {
      command: "str_replace",
      path: "/App.jsx",
    })
  ).toBe("Editing App.jsx");
  expect(
    getToolCallLabel("str_replace_editor", {
      command: "insert",
      path: "/App.jsx",
    })
  ).toBe("Editing App.jsx");
});

test("view command shows 'Viewing <file>'", () => {
  expect(
    getToolCallLabel("str_replace_editor", {
      command: "view",
      path: "/lib/utils.js",
    })
  ).toBe("Viewing utils.js");
});

test("undo_edit command shows 'Reverting <file>'", () => {
  expect(
    getToolCallLabel("str_replace_editor", {
      command: "undo_edit",
      path: "/lib/utils.js",
    })
  ).toBe("Reverting utils.js");
});

test("basename strips nested directories from the path", () => {
  expect(
    getToolCallLabel("str_replace_editor", {
      command: "create",
      path: "/a/b/c/Deep.jsx",
    })
  ).toBe("Creating Deep.jsx");
});

// getToolCallLabel — file_manager

test("rename command shows both file names", () => {
  expect(
    getToolCallLabel("file_manager", {
      command: "rename",
      path: "/components/Old.jsx",
      new_path: "/components/New.jsx",
    })
  ).toBe("Renaming Old.jsx to New.jsx");
});

test("delete command shows 'Deleting <file>'", () => {
  expect(
    getToolCallLabel("file_manager", {
      command: "delete",
      path: "/components/Card.jsx",
    })
  ).toBe("Deleting Card.jsx");
});

// getToolCallLabel — fallbacks

test("unknown tool falls back to the raw tool name", () => {
  expect(getToolCallLabel("some_other_tool", { command: "x" })).toBe(
    "some_other_tool"
  );
});

test("empty or missing args fall back to a generic file label", () => {
  expect(getToolCallLabel("str_replace_editor", {})).toBe("Editing file");
  expect(getToolCallLabel("str_replace_editor", undefined)).toBe("Editing file");
  expect(getToolCallLabel("file_manager", {})).toBe("Modifying file");
});

// Component rendering

test("renders the friendly label, not the raw tool name", () => {
  render(
    <ToolInvocation
      toolName="str_replace_editor"
      args={{ command: "create", path: "/components/Card.jsx" }}
      state="result"
      result="File created: /components/Card.jsx"
    />
  );

  expect(screen.getByText("Creating Card.jsx")).toBeDefined();
  expect(screen.queryByText("str_replace_editor")).toBeNull();
});

test("shows a spinner while the tool call is in progress", () => {
  const { container } = render(
    <ToolInvocation
      toolName="str_replace_editor"
      args={{ command: "create", path: "/components/Card.jsx" }}
      state="call"
    />
  );

  // Loader2 renders an svg with the animate-spin class; no emerald dot yet
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows a completion dot once the tool call has a result", () => {
  const { container } = render(
    <ToolInvocation
      toolName="str_replace_editor"
      args={{ command: "create", path: "/components/Card.jsx" }}
      state="result"
      result="File created: /components/Card.jsx"
    />
  );

  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();
});
