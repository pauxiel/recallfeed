import { RecallFeedError } from "@recallfeed/core";

/**
 * The API answered with an error, or with something that is not a RecallFeed response.
 *
 * `code` is the API's own stable code (such as `AUTH_API_KEY_MISSING` or `NOT_FOUND_FEED_ITEM`) when the
 * body was a RecallFeed error, `CLIENT_BAD_RESPONSE` when it was not, and `CLIENT_NETWORK` when no
 * response arrived. The message never contains the API key.
 */
export class RecallFeedApiError extends RecallFeedError {
  /** The HTTP status, or 0 when no response arrived. */
  readonly status: number;

  /**
   * @param message - What went wrong, from the API's `error` field when there is one.
   * @param code - The stable code.
   * @param status - The HTTP status, or 0.
   */
  constructor(message: string, code: string, status: number) {
    super(message, code);
    this.name = "RecallFeedApiError";
    this.status = status;
  }
}
