# @recallfeed/core

Domain types, interface contracts, and the error hierarchy for RecallFeed.
This package has **zero runtime dependencies** and no knowledge of any
application built on the skeleton. Every other `@recallfeed/*` package depends
on it; it depends on none of them.

Specification: [`.kiro/specs/01-core-domain.md`](../../.kiro/specs/01-core-domain.md).

## Public API

Everything is exported from `src/index.ts`.

| Kind | Exports |
|---|---|
| Domain types | `Source`, `SourceType`, `Note`, `NoteMetadata`, `NormalizedNote`, `FeedItem`, `CardType`, `ReviewEvent`, `ReviewAction`, `FeedConfig`, `ResurfacingStrategyName` |
| Interfaces | `IConnector`, `IResurfacingStrategy`, `IAIProvider`, `IFeedEngine` |
| Supporting types | `ConnectorCredentials`, `ConnectorValidationResult`, `AIOptions`, `GetFeedOptions`, `FeedPage`, `ImportResult` |
| Errors | `RecallFeedError`, `ConnectorError`, `ValidationError`, `NotFoundError`, `AuthorizationError`, `RateLimitError` |
| Review actions | `REVIEW_ACTIONS` (the six names as a runtime list), `isReviewAction(value)`, `AllReviewActionsListed` (a compile-time check that the list and the `ReviewAction` type agree) |

The only runtime code is the error classes in `src/errors.ts` and the review-action list in
`src/review-actions.ts`. Types and interfaces are erased at compile time.

## Constraints

- `dependencies` stays empty. `devDependencies` come from the workspace root.
- `src/` must not use `fetch`, `crypto`, or Node built-ins. `tsconfig.json` sets
  `"types": []` so the compiler rejects them.
- Tests run in the Workers runtime through `@cloudflare/vitest-plugin`.

## Commands

```sh
pnpm --filter @recallfeed/core build      # emit dist/ with tsc
pnpm --filter @recallfeed/core typecheck  # source (no ambient types) and tests
pnpm --filter @recallfeed/core test       # Vitest in the Workers runtime
```
