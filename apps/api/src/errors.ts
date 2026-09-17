/** Structured errors → the `{ success, data, error }` envelope. */

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status = 400, details: unknown = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const unauthorized = (message = "Authentication required.") => new AppError("unauthorized", message, 401);
export const forbidden = (message = "You do not have access to this resource.") => new AppError("forbidden", message, 403);
export const notFound = (message = "Not found.") => new AppError("not_found", message, 404);
export const notConfigured = (message: string) => new AppError("not_configured", message, 503);
export const aiUnavailable = (message: string) => new AppError("ai_unavailable", message, 503);

export const success = <T>(data: T) => ({ success: true as const, data, error: null });
export const failure = (code: string, message: string, details: unknown = null) => ({ success: false as const, data: null, error: { code, message, details } });

/** `<user_id>/<file>` — every stored object lives in the owner's folder. */
export function assertOwnerPath(userId: string, path: string): void {
  if (!path.startsWith(`${userId}/`) || path.includes("..")) throw forbidden("That file does not belong to you.");
}
