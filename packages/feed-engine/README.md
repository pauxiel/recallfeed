# @recallfeed/feed-engine

Coordinates the Markdown import path and the intermediate feed reads. It uses `@recallfeed/connectors`
to parse, `@recallfeed/database` to store, and `@recallfeed/core` for the types. It knows nothing about
HTTP, authentication, or any application. Specification: [`.kiro/specs/04-feed-engine.md`](../../.kiro/specs/04-feed-engine.md).

## Scope (Gate 2, Phase 2)

Built: Markdown import, original-card creation, review actions (Phase 3), the recency and importance
strategies with keyset cursor pagination, and the highlight card generator (Phase 4). Not built, and not
claimed: the `due_review` strategy, the Notion import, and AI or queued work. `FeedEngine` therefore does not
implement core's whole `IFeedEngine`.

## Public API

| Export | Purpose |
|---|---|
| `FeedEngine` | Request-scoped. Build one per request: `new FeedEngine(createDb(env.DATABASE_URL))`. |
| `FeedEngine.importMarkdown(content, { name?, cardTypes? })` | Validates, upserts the source, parses, stores notes, creates cards of `cardTypes` (default `original`; a type without a generator is refused before anything is written). Re-importing with more types adds the missing cards. Returns `{ sourceId, queued, notesImported, feedItemsCreated }` (Spec 05). |
| `parseImportCardTypes(raw)`, `CARD_TYPES`, `IMPORT_CARD_TYPES` | Reads a `DEFAULT_CARD_TYPES` value: unset means `original`; `original` is always included; known types without a generator (`summary`, `reflection_prompt`, `code_snippet`) are skipped; an unknown name throws `VALIDATION_CARD_TYPE`. |
| `FeedEngine.listFeedItems({ limit?, isPublicRequest, strategy?, cursor? })` | One keyset page, `{ items, nextCursor }`: up to 50 cards, default 10, in `recency` (default) or `importance` order. Public requests see published cards only; snoozed cards are hidden from everyone. `nextCursor` is null on the last page. Throws `VALIDATION_LIMIT`, `VALIDATION_STRATEGY` or `VALIDATION_CURSOR`. |
| `RecencyStrategy`, `ImportanceStrategy`, `getStrategy(name)`, `DEFAULT_STRATEGY` | The two strategies (core's `IResurfacingStrategy` plus their integer `keys`). Order: recency is effective time then `id`; importance is `reviewCount`, effective time, then `id`. |
| `encodeCursor(strategy, item)`, `decodeCursor(cursor, strategy)`, `MAX_CURSOR_LENGTH` | The cursor format of the Spec 04 clarification, strict on decode. Opaque but not encrypted: a public cursor discloses the last card's effective time and, under `importance`, its `reviewCount` (accepted; see the Spec 04 clarification). |
| `FeedEngine.getFeedItem(id, { isPublicRequest })` | One card, or null. A public request cannot see an unpublished card. |
| `FeedEngine.recordReview(id, action, { snoozeHours })` | Applies one of the six review actions and logs it in one statement. Returns the updated card. Throws `ValidationError` for an unknown action or unusable `snoozeHours`, `NotFoundError` (`NOT_FOUND_FEED_ITEM`) for an unknown card. Authorization is the caller's job. |
| `DEFAULT_SNOOZE_HOURS` | 24 (Spec 04). |
| `generateFeedItems(db, sourceId, cardTypes)` | Creates the missing cards of `original` or `highlight`. Other types throw instead of being skipped. A note with nothing to highlight gets no highlight card. |
| `generateHighlightCard(note)`, `extractHighlight(content)` | The highlight rule: the first blockquote; otherwise every `**strong**`, `__strong__`, `*em*` and `_em_` span in order; otherwise none. Code is never a highlight. |
| `assertValidImport(content, name?)` | The input checks, also usable by an API layer. |

## How an import behaves

- **Idempotent.** Every step is safe to repeat. A request that fails partway can be retried, and importing
  the same text again changes nothing but timestamps (`feedItemsCreated` is 0).
- **Source-scoped.** The `name` identifies the source. The same text under another name is separate notes.
  With no name, imports share one default source.
- **Bounded database use.** An import makes a fixed handful of HTTP requests however many notes it holds
  (measured: 5 for a 300-note import, 4 for a repeat; the Workers free tier allows 50 subrequests).
- **Validation.** 10 bytes to 100 KB in UTF-8 bytes. Text containing a NUL character or a lone surrogate is
  rejected because PostgreSQL cannot store it. Names are trimmed, at most 200 characters, with no control characters.
- `notesImported` counts the notes now stored for this import, new and already-existing alike.
  `feedItemsCreated` counts only cards this call created.

## The intermediate feed

`listFeedItems` returns a fixed order (oldest effective review time, then id) with no cursor. It is
deliberately narrower than the final feed contract, which needs strategy-dependent cursors (Phase 4, Task 27).
