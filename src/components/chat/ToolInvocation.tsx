"use client";

import { Loader2 } from "lucide-react";

function basename(path?: string): string {
  if (!path) return "file";
  return path.split("/").filter(Boolean).pop() || "file";
}

export function getToolCallLabel(toolName: string, args: any): string {
  const command = args?.command;

  if (toolName === "str_replace_editor") {
    const name = basename(args?.path);
    switch (command) {
      case "create":
        return `Creating ${name}`;
      case "view":
        return `Viewing ${name}`;
      case "undo_edit":
        return `Reverting ${name}`;
      case "str_replace":
      case "insert":
      default:
        return `Editing ${name}`;
    }
  }

  if (toolName === "file_manager") {
    const name = basename(args?.path);
    switch (command) {
      case "rename":
        return `Renaming ${name} to ${basename(args?.new_path)}`;
      case "delete":
        return `Deleting ${name}`;
      default:
        return `Modifying ${name}`;
    }
  }

  return toolName;
}

interface ToolInvocationProps {
  toolName: string;
  args: any;
  state: string;
  result?: unknown;
}

export function ToolInvocation({
  toolName,
  args,
  state,
  result,
}: ToolInvocationProps) {
  const label = getToolCallLabel(toolName, args);
  const isComplete = state === "result" && Boolean(result);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isComplete ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
