/**
 * Public API of `@recallfeed/database`.
 *
 * Only symbols exported from this barrel are part of the stable contract. Node-only test helpers
 * live behind the separate `@recallfeed/database/testing` entry point.
 */

export { createDb } from "./client";
export type { DatabaseEnv, DbClient } from "./client";

export { getSourceById, updateSourceSyncedAt, upsertSource } from "./queries/sources";
export type { SourceInput } from "./queries/sources";

export { getNotesBySourceId, getNotesMissingCardType, upsertNote, upsertNotes } from "./queries/notes";
export type { UpsertedNote } from "./queries/notes";

export {
  MAX_CANDIDATE_LIMIT,
  getFeedItemById,
  getFeedItemCandidates,
  insertFeedItem,
  insertFeedItems,
} from "./queries/feed-items";
export type { CandidateOptions, CandidateOrder, CandidatePosition, NewFeedItem } from "./queries/feed-items";

export {
  MAX_SNOOZE_HOURS,
  applyReviewAction,
  insertReviewEvent,
  listReviewEventsByFeedItem,
} from "./queries/review-events";

export { isUuid } from "./queries/rows";

// Test aid: counts driver HTTP requests (Worker subrequests) made by an operation.
export { countHttpRequests } from "./count-requests";

// Development and test only: routes the exact local proxy host to the local proxy. Production
// Worker code never calls it, and it changes nothing for any other host.
export { LOCAL_PROXY_HOST, configureLocalNeonHttp } from "./local-proxy";
