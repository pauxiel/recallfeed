import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  ConnectorError,
  NotFoundError,
  RateLimitError,
  RecallFeedError,
  ValidationError,
} from "../index";

describe("RecallFeedError", () => {
  it("carries a message, a code, and the base class name", () => {
    const error = new RecallFeedError("Something failed", "TEST_CODE");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Something failed");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("RecallFeedError");
  });
});

describe("RecallFeedError subclasses", () => {
  const subclasses = [
    ["ConnectorError", ConnectorError, "CONNECTOR_FAILED"],
    ["ValidationError", ValidationError, "VALIDATION_CONTENT_TOO_LARGE"],
    ["NotFoundError", NotFoundError, "NOT_FOUND_SOURCE"],
    ["AuthorizationError", AuthorizationError, "AUTH_UNAUTHENTICATED"],
    ["RateLimitError", RateLimitError, "RATE_LIMIT"],
  ] as const;

  it.each(subclasses)(
    "%s extends RecallFeedError and preserves its code",
    (_label, ErrorClass, code) => {
      const error = new ErrorClass("failure", code);
      expect(error).toBeInstanceOf(RecallFeedError);
      expect(error).toBeInstanceOf(ErrorClass);
      expect(error.code).toBe(code);
      expect(error.message).toBe("failure");
    },
  );

  it("lets callers separate domain errors from unexpected errors", () => {
    const domain: unknown = new NotFoundError("missing", "NOT_FOUND_SOURCE");
    const unexpected: unknown = new TypeError("bug");
    expect(domain instanceof RecallFeedError).toBe(true);
    expect(unexpected instanceof RecallFeedError).toBe(false);
  });
});
