import type { Context } from "hono";
import { AuthorizationError, NotFoundError, RateLimitError, RecallFeedError, ValidationError } from "@recallfeed/core";
import type { AppEnv } from "../types";

/** The JSON body of every error response (project conventions). */
export type ErrorBody = { error: string; code: string };

/**
 * Builds an error response. The message is written for the caller and must never contain secrets,
 * stack traces, SQL, or connection details.
 *
 * @param c - The Hono context.
 * @param status - The HTTP status.
 * @param error - A short human-readable message.
 * @param code - A stable machine-readable code.
 */
export function errorResponse(
  c: Context<AppEnv>,
  status: 400 | 401 | 403 | 404 | 405 | 413 | 429 | 500,
  error: string,
  code: string,
): Response {
  const body: ErrorBody = { error, code };
  return c.json(body, status);
}

function statusFor(error: RecallFeedError): 400 | 401 | 403 | 404 | 429 | 500 {
  if (error instanceof ValidationError) return 400;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof RateLimitError) return 429;
  if (error instanceof AuthorizationError) return error.code === "AUTH_REQUIRED" ? 401 : 403;
  // A Markdown connector failure is about the caller's content. Any other connector failure is ours.
  return error.code.startsWith("MARKDOWN_") ? 400 : 500;
}

/**
 * Turns any thrown error into a safe JSON response.
 *
 * Domain errors keep their status and code, and their messages are written to be shown. Everything
 * else (database errors, bugs) becomes a generic 500 with no detail. The cause is logged in
 * structured form with the request ID, and the log never includes the request body or any credential.
 *
 * @param error - What was thrown.
 * @param c - The Hono context.
 */
export function handleError(error: Error, c: Context<AppEnv>): Response {
  const requestId = c.get("requestId") ?? "unknown";
  if (error instanceof RecallFeedError) {
    const status = statusFor(error);
    if (status === 500) {
      console.error(JSON.stringify({ error: error.name, code: error.code, source: "api", operation: `${c.req.method} ${c.req.path}`, requestId }));
      return errorResponse(c, 500, "Internal server error", "INTERNAL_ERROR");
    }
    return errorResponse(c, status, error.message, error.code);
  }
  console.error(
    JSON.stringify({ error: error.name, source: "api", operation: `${c.req.method} ${c.req.path}`, requestId }),
  );
  return errorResponse(c, 500, "Internal server error", "INTERNAL_ERROR");
}
