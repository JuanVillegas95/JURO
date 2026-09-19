import { randomUUID } from "node:crypto";
import { z } from "zod";

export type JuroErrorCode =
  | "INVALID_REQUEST"
  | "PROBLEM_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "UNSUPPORTED_LANGUAGE"
  | "INVALID_PROBLEM"
  | "WORKSPACE_CONFLICT"
  | "WORKSPACE_NOT_WRITABLE"
  | "INVALID_WORKSPACE"
  | "EDITOR_NOT_FOUND"
  | "TOOLCHAIN_NOT_FOUND"
  | "MCP_UNAVAILABLE"
  | "CLAUDE_UNAVAILABLE"
  | "INVALID_BACKUP"
  | "INCOMPATIBLE_BACKUP"
  | "BACKUP_RESTORE_FAILED"
  | "BACKUP_BUSY"
  | "INTERNAL_ERROR";

export class JuroError extends Error {
  readonly name = "JuroError";

  constructor(
    public readonly code: JuroErrorCode,
    message: string,
    public readonly hint?: string,
    public readonly statusCode = 500,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export interface ErrorResponse {
  code: JuroErrorCode;
  message: string;
  hint?: string;
  requestId: string;
  details: string[];
}

export function requestIdFor(request: { id?: string }): string {
  return request.id || randomUUID();
}

export function classifyError(error: unknown): JuroError {
  if (error instanceof JuroError) return error;

  if (error instanceof z.ZodError || (error && typeof error === "object" && "name" in error && error.name === "ZodError")) {
    return new JuroError(
      "INVALID_REQUEST",
      "The request could not be validated.",
      "Check the required fields and try again.",
      400,
      { cause: error },
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (/problem .* was not found|problem .* does not exist/.test(normalized)) {
    return new JuroError("PROBLEM_NOT_FOUND", "The requested problem was not found.", "Refresh the problem list and select an available problem.", 404, { cause: error });
  }
  if (/practice session .* was not found|knowledge-check session was not found|session .* was not found/.test(normalized)) {
    return new JuroError("SESSION_NOT_FOUND", "The practice session was not found.", "Start the problem again to create a fresh session.", 404, { cause: error });
  }
  if (/not managed by juro/.test(normalized)) {
    return new JuroError("WORKSPACE_CONFLICT", "The configured workspace contains files that JURO did not create.", "Choose another workspace directory or move the existing juro-current folder, then try again.", 409, { cause: error });
  }
  if (/outside the configured juro workspace/.test(normalized)) {
    return new JuroError("INVALID_WORKSPACE", "The configured workspace path is not valid.", "Choose a writable directory dedicated to JURO workspaces.", 400, { cause: error });
  }
  if (/eacces|eperm|permission denied|workspace.*not writable/.test(normalized)) {
    return new JuroError("WORKSPACE_NOT_WRITABLE", "JURO cannot write to the configured workspace.", "Choose a writable directory and verify its permissions, then try again.", 424, { cause: error });
  }
  if (/must include at least 3 runnable test cases/.test(normalized)) {
    return new JuroError("INVALID_PROBLEM", "This problem does not have enough runnable test cases.", "Add at least three test cases before running or submitting it.", 422, { cause: error });
  }
  if (/supports java, python, javascript, and go submissions only|unsupported problem language|language must be/.test(normalized)) {
    return new JuroError("UNSUPPORTED_LANGUAGE", "JURO supports Java, Python, JavaScript, and Go only.", "Choose the language configured for this problem.", 400, { cause: error });
  }
  if (/spawn .* enoent|editor could not be opened|unable to start (code|nvim|vim)/.test(normalized)) {
    return new JuroError("EDITOR_NOT_FOUND", "The selected editor was not found.", "Install the editor, add it to PATH, or enter its executable path in Settings.", 424, { cause: error });
  }
  if (/enoent|command not found|not found on path|toolchain is not available/.test(normalized)) {
    return new JuroError("TOOLCHAIN_NOT_FOUND", "A required local tool was not found on PATH.", "Install the required compiler or runtime, then restart JURO after updating your PATH.", 424, { cause: error });
  }
  if (/mcp|claude/.test(normalized)) {
    return new JuroError("MCP_UNAVAILABLE", "The local Claude/MCP connection is unavailable.", "Check the MCP configuration and make sure the JURO server script can start.", 503, { cause: error });
  }

  return new JuroError(
    "INTERNAL_ERROR",
    "JURO could not complete the request.",
    "Try again. If the problem continues, include the request ID in a bug report.",
    500,
    { cause: error },
  );
}

export function errorResponse(error: unknown, requestId: string): ErrorResponse {
  const classified = classifyError(error);
  return {
    code: classified.code,
    message: classified.message,
    ...(classified.hint ? { hint: classified.hint } : {}),
    requestId,
    details: [classified.message],
  };
}
