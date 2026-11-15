/**
 * Public API of `@recallfeed/core`.
 *
 * Only symbols exported from this barrel are part of the stable contract.
 */

export type {
  AIOptions,
  CardType,
  ConnectorCredentials,
  ConnectorValidationResult,
  FeedConfig,
  FeedItem,
  FeedPage,
  GetFeedOptions,
  ImportResult,
  NormalizedNote,
  Note,
  NoteMetadata,
  ResurfacingStrategyName,
  ReviewAction,
  ReviewEvent,
  Source,
  SourceType,
} from "./types";

export type {
  IAIProvider,
  IConnector,
  IFeedEngine,
  IResurfacingStrategy,
} from "./interfaces";

export {
  AuthorizationError,
  ConnectorError,
  NotFoundError,
  RateLimitError,
  RecallFeedError,
  ValidationError,
} from "./errors";

export { REVIEW_ACTIONS, isReviewAction } from "./review-actions";
export type { AllReviewActionsListed } from "./review-actions";
