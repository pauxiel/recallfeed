/**
 * Error hierarchy for RecallFeed (Spec 01).
 *
 * All domain errors extend {@link RecallFeedError}, which lets callers tell
 * RecallFeed errors apart from unexpected runtime errors.
 */

/** Base class for every RecallFeed domain error. */
export class RecallFeedError extends Error {
  /** A stable, machine-readable error code. */
  readonly code: string;

  /**
   * @param message - Human-readable description. Must not contain secrets.
   * @param code - Stable error code, for example "NOT_FOUND_SOURCE".
   */
  constructor(message: string, code: string) {
    super(message);
    this.name = "RecallFeedError";
    this.code = code;
  }
}

/** A connector failed to validate or import. Codes use the prefix `CONNECTOR_`. */
export class ConnectorError extends RecallFeedError {}

/** Input failed validation. Codes use the prefix `VALIDATION_`. */
export class ValidationError extends RecallFeedError {}

/** A requested resource does not exist. Codes use the prefix `NOT_FOUND_`. */
export class NotFoundError extends RecallFeedError {}

/** The caller is not authenticated or not permitted. Codes use the prefix `AUTH_`. */
export class AuthorizationError extends RecallFeedError {}

/** The caller exceeded a rate or size limit. The code is `RATE_LIMIT`. */
export class RateLimitError extends RecallFeedError {}
