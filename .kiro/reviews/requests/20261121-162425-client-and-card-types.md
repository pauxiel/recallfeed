# RecallFeed Review Request: client package and highlight cards in imports (Nov 22 work)

**Review Request ID:** recallfeed-20261121-162425-client-and-card-types
**Date:** 2026-11-21 16:24:25 UTC
**Workspace:** `/Users/paulobayuwana/.treehouse/recallfeed-38ad39/6/recallfeed`, branch `feat/gate3-client-and-card-types` (local only)
**Revision to review:** `c8edb88b010f66c09ebd4d7ba4c461246e5802e5`, based on `cf4be4c` (main after PR #6)

## Changes

1. **Highlight cards in normal imports (`ca65d10`).**
   - `packages/feed-engine/src/card-types.ts` (`parseImportCardTypes`):
     - unset means `original`, and `original` is always included;
     - known types without a generator (`summary`, `reflection_prompt`, `code_snippet`) are skipped;
     - an unknown, miscased or empty entry throws `VALIDATION_CARD_TYPE` without echoing the value.
   - `FeedEngine.importMarkdown` takes `cardTypes` and checks it before the first write.
   - `packages/api/src/card-types-config.ts` and `routes/import.ts`: the import reads `DEFAULT_CARD_TYPES`
     after authorization and before the body. A bad value is a generic 500 that writes nothing.
   - ReflectionFeed sets the steering value `original,highlight,reflection_prompt`, and its seed uses it.
2. **`@recallfeed/client` (`0be327f`).**
   - Typed `listFeed`, `getCard`, `importMarkdown` and `review`. It depends only on core and `fetch`.
   - Failures are `RecallFeedApiError` with the API's code and status, or `CLIENT_BAD_RESPONSE` or `CLIENT_NETWORK`.
     The underlying network message is not passed on.
   - Creating a client with an API key where `window` and `document` exist throws.

## Evidence

- Tests:
  - card types: 14 parser, 3 engine and 5 API database tests;
  - client: 19.
- Mutants: 20 of 20 caught (10 card-type, 10 client).
- Gate: lint, typecheck and build exit 0 (7 tasks); checker controls 9 of 9; **889 of 889** tests, none
  skipped; coverage 96.47/92.74/98.32/96.32.
  - The suite ran before a build-only fix to `packages/client/tsconfig.build.json`, which had kept core's
    `rootDir`.
  - The rebuild after that fix passed.
- Skeleton boundary checks after every `packages/` save: no `apps/` imports, core imports nothing, the client
  imports only core, and no app names appear in packages (including tests).

## Limits

- The client has no consumer yet. DevRecall (Nov 23) is the first.
- Not pushed and not deployed. The live ReflectionFeed has no highlight cards until a redeploy and a re-seed.

**Asked:** approve, or name changes.
