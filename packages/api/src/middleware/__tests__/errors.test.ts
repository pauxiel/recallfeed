import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  ConnectorError,
  NotFoundError,
  RateLimitError,
  RecallFeedError,
  ValidationError,
} from "@recallfeed/core";
import { handleError } from "../errors";
import { requestId } from "../request-id";
import type { AppEnv } from "../../types";

function appThatThrows(error: unknown): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", requestId);
  app.get("/boom", () => {
    throw error;
  });
  app.onError(handleError);
  return app;
}

const SECRET = "postgres://user:hunter2@db.example.test/prod";

describe("handleError", () => {
  let logged: string[];
  beforeEach(() => {
    logged = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["ValidationError", new ValidationError("limit must be 1 to 50", "VALIDATION_LIMIT"), 400, "VALIDATION_LIMIT"],
    ["NotFoundError", new NotFoundError("no such thing", "NOT_FOUND_X"), 404, "NOT_FOUND_X"],
    ["RateLimitError", new RateLimitError("slow down", "RATE_LIMITED"), 429, "RATE_LIMITED"],
    ["AuthorizationError AUTH_REQUIRED", new AuthorizationError("sign in", "AUTH_REQUIRED"), 401, "AUTH_REQUIRED"],
    ["AuthorizationError other", new AuthorizationError("not you", "AUTH_FORBIDDEN"), 403, "AUTH_FORBIDDEN"],
    ["a Markdown connector error", new ConnectorError("bad markdown", "MARKDOWN_INVALID"), 400, "MARKDOWN_INVALID"],
  ])("%s keeps its status, code and message", async (_label, error, status, code) => {
    const response = await appThatThrows(error).request("/boom");

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: error.message, code });
  });

  it("any other connector error is our fault: a generic 500 that hides the message", async () => {
    const response = await appThatThrows(new ConnectorError(`failed using ${SECRET}`, "NOTION_DOWN")).request("/boom");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error", code: "INTERNAL_ERROR" });
    expect(logged.join("\n")).not.toContain("hunter2");
  });

  it("a configuration error is a generic 500 and the message is not returned or logged", async () => {
    const response = await appThatThrows(new RecallFeedError(`bad config ${SECRET}`, "INTERNAL_CONFIG")).request("/boom");

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("hunter2");
    expect(logged.join("\n")).not.toContain("hunter2");
    expect(logged.join("\n")).toContain("INTERNAL_CONFIG");
  });

  it("an unexpected error is a generic 500, logged with the request ID and without its message", async () => {
    const response = await appThatThrows(new Error(`connect failed for ${SECRET}`)).request("/boom");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error", code: "INTERNAL_ERROR" });
    const line = JSON.parse(logged[0] ?? "{}") as Record<string, unknown>;
    expect(line).toMatchObject({ source: "api", operation: "GET /boom" });
    expect(line.requestId).toBe(response.headers.get("X-Request-Id"));
    expect(logged.join("\n")).not.toContain("hunter2");
    expect(Object.keys(line)).not.toContain("stack");
  });
});
