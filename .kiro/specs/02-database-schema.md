# Spec 02 — Database Schema and Migration System

**Package:** `@recallfeed/database`
**Status:** Approved
**Depends on:** Spec 01 (core domain types)

---

## Purpose

`@recallfeed/database` owns the PostgreSQL schema, the migration system, the Neon client factory, and all typed query functions. No other package writes SQL. No other package imports from `@neondatabase/serverless` directly.

Both demo applications use identical schema files against separate Neon database instances. Schema divergence between applications is forbidden.

---

## Database Schema

### `_schema_migrations`

Tracks applied migrations. Created by the migration script before any other migration runs.

```sql
CREATE TABLE IF NOT EXISTS _schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `sources`

A connected knowledge source. Config stores non-secret source-specific data. Secrets live in Worker env bindings only.

```sql
CREATE TABLE sources (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN ('notion', 'markdown')),
  config        JSONB       NOT NULL DEFAULT '{}',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `notes`

Normalized imported content. `content` is immutable after import. `content_hash` enables deduplication across re-imports.

```sql
CREATE TABLE notes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID        NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title         TEXT,
  content       TEXT        NOT NULL,
  content_hash  TEXT        NOT NULL,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX notes_source_content_hash_idx ON notes(source_id, content_hash);
CREATE INDEX notes_source_id_idx ON notes(source_id);
CREATE INDEX notes_imported_at_idx ON notes(imported_at DESC);
```

The unique index on `(source_id, content_hash)` prevents duplicate notes from re-imports without requiring a full content scan.

### `feed_items`

Surfaced cards derived from notes. One note can have multiple feed items of different types. AI-generated items are explicitly flagged. `is_published` gates public-mode visibility.

```sql
CREATE TABLE feed_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id          UUID        NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  source_id        UUID        NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  card_type        TEXT        NOT NULL CHECK (card_type IN (
                                 'original', 'highlight', 'summary',
                                 'reflection_prompt', 'code_snippet'
                               )),
  content          TEXT        NOT NULL,
  is_ai_generated  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_published     BOOLEAN     NOT NULL DEFAULT FALSE,
  review_count     INTEGER     NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  saved_at         TIMESTAMPTZ,
  snoozed_until    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX feed_items_note_card_type_idx ON feed_items(note_id, card_type);
CREATE INDEX feed_items_note_id_idx ON feed_items(note_id);
CREATE INDEX feed_items_source_id_idx ON feed_items(source_id);
CREATE INDEX feed_items_is_published_idx ON feed_items(is_published) WHERE is_published = TRUE;
CREATE INDEX feed_items_snoozed_until_idx ON feed_items(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX feed_items_last_reviewed_at_idx ON feed_items(last_reviewed_at NULLS FIRST);
```

### `review_events`

Immutable audit log of user interactions. Never updated or deleted.

```sql
CREATE TABLE review_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID        NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL CHECK (action IN (
                             'reviewed', 'saved', 'unsaved',
                             'snoozed', 'published', 'unpublished'
                           )),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX review_events_feed_item_id_idx ON review_events(feed_item_id);
CREATE INDEX review_events_created_at_idx ON review_events(created_at DESC);
```

---

## Migration System

### File Layout

```
packages/database/src/migrations/
├── 001_initial.sql          ← Creates all tables above
└── 002_*.sql                ← Future migrations added here
```

### Migration Script (`migrate.ts`)

A standalone TypeScript script run outside the Worker (not inside the Worker runtime).

```
pnpm --filter @recallfeed/database db:migrate
```

**Migration file naming:** Files must be named `NNN_description.sql` where `NNN` is a zero-padded 3-digit number (e.g., `001_initial.sql`, `002_add_published_state.sql`, `010_add_tags.sql`). Sorting is **numeric by prefix**, not ASCII lexicographic (which would incorrectly sort `10_*.sql` before `2_*.sql`).

Algorithm:
1. Connect to Neon using `DATABASE_URL` from environment.
2. Create `_schema_migrations` if it does not exist.
3. Read all `*.sql` files from `src/migrations/`.
4. Extract numeric prefix from each filename and sort numerically.
5. For each file in sorted order, check whether its `filename` exists in `_schema_migrations`.
6. If not applied: execute the file's SQL, then insert the filename into `_schema_migrations`.
7. If already applied: skip.
8. Log each applied/skipped migration.

The script runs outside the Workers runtime (in Node.js via tsx). It is only used during local development and CI database setup. It is never called from within the Worker.

### Rollback Policy

There are no rollback migrations in the MVP. Rollback is handled by deploying a new forward migration. This is consistent with Neon's branching capability for non-destructive schema exploration.

---

## Neon Client

```
packages/database/src/client.ts
```

Exports a single factory function:

```ts
import { neon } from "@neondatabase/serverless";

export function createDb(databaseUrl: string) {
  return neon(databaseUrl);
}

export type DbClient = ReturnType<typeof createDb>;
```

Called with `env.DATABASE_URL` inside each route handler or Inngest function. Never called at module initialization (top-level) in the Worker — bindings are not available in the global scope for I/O operations.

---

## Typed Query Functions

All SQL lives in `packages/database/src/queries/`. Each file corresponds to one domain entity.

### Query Function Signature Pattern

```ts
// packages/database/src/queries/feed-items.ts

export async function getFeedItems(
  db: DbClient,
  options: GetFeedItemsOptions
): Promise<FeedItem[]> { ... }

export async function updateFeedItemReview(
  db: DbClient,
  feedItemId: string,
  update: FeedItemReviewUpdate
): Promise<FeedItem | null> { ... }
```

### Required Query Functions

**`queries/sources.ts`**
- `createSource(db, input)` → `Source`
- `getSourceById(db, id)` → `Source | null`
- `listSources(db)` → `Source[]`
- `updateSource(db, id, update)` → `Source | null`
- `deleteSource(db, id)` → `void`
- `updateSourceSyncedAt(db, id, syncedAt)` → `void`

**`queries/notes.ts`**
- `createNote(db, input)` → `Note`
- `upsertNote(db, input)` → `{ note: Note; created: boolean }` — inserts or returns existing by `(source_id, content_hash)`, never overwrites content
- `getNoteById(db, id)` → `Note | null`
- `listNotesBySource(db, sourceId)` → `Note[]`
- `countNotesBySource(db, sourceId)` → `number`

**`queries/feed-items.ts`**
- `createFeedItem(db, input)` → `FeedItem`
- `getFeedItemById(db, id)` → `FeedItem | null`
- `getFeedItemByNoteAndType(db, noteId, cardType)` → `FeedItem | null` — prevents duplicate card types per note
- `listFeedItemsForResurfacing(db, options)` → `FeedItem[]` — fetches candidates respecting `snoozedUntil`, `isPublished` filter, and `enabledCardTypes`
- `updateFeedItem(db, id, update)` → `FeedItem | null`
- `publishFeedItem(db, id)` → `FeedItem | null`
- `unpublishFeedItem(db, id)` → `FeedItem | null`

**`queries/review-events.ts`**
- `createReviewEvent(db, input)` → `ReviewEvent`
- `listReviewEventsByFeedItem(db, feedItemId)` → `ReviewEvent[]`

---

## Seed Data

A `seed.ts` script populates sample content for demo deployments. Two seed datasets exist:

- `seeds/reflection-feed-seed.ts` — sermons, book highlights, personal reflections
- `seeds/dev-recall-seed.ts` — programming notes, code snippets, architecture concepts

Both datasets are structured identically (same `Source` and `Note` shape). The seed script is run once during demo deployment, not on every startup.

```
pnpm --filter @recallfeed/database db:seed -- --dataset=dev-recall
```

---

## Package Constraints

- Runtime dependencies: `@neondatabase/serverless`, `@recallfeed/core`
- The migration script and seed scripts are `devDependencies` context — they use `tsx` to run in Node.js
- No ORM, no query builder beyond raw SQL
- All query functions use parameterized queries exclusively — never string interpolation

---

## File Layout

```
packages/database/
├── src/
│   ├── client.ts
│   ├── migrations/
│   │   └── 001_initial.sql
│   ├── queries/
│   │   ├── sources.ts
│   │   ├── notes.ts
│   │   ├── feed-items.ts
│   │   └── review-events.ts
│   ├── seeds/
│   │   ├── reflection-feed-seed.ts
│   │   └── dev-recall-seed.ts
│   ├── migrate.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Acceptance Criteria

- [ ] `001_initial.sql` creates all five tables with the exact column definitions specified above.
- [ ] All indexes specified above are created.
- [ ] `migrate.ts` applies unapplied migrations in lexicographic order and records them in `_schema_migrations`.
- [ ] Running `migrate.ts` twice produces no errors and applies each migration exactly once.
- [ ] `createDb` returns a typed Neon SQL client.
- [ ] All query functions return the correct domain types from `@recallfeed/core`.
- [ ] All query functions use parameterized queries — no user input is interpolated into SQL strings.
- [ ] `getFeedItemByNoteAndType` prevents duplicate card types per note.
- [ ] `upsertNote` never overwrites `content` of an existing note.
- [ ] TypeScript compilation passes with `strict: true`.
