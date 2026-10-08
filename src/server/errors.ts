export type AppErrorCode =
  "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "UNAUTHORIZED" | "PAYLOAD_TOO_LARGE";

/** Domain failure thrown by services; HTTP, actions and MCP each translate it. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
