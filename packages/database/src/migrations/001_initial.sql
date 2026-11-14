-- 001_initial.sql: the initial RecallFeed schema (Spec 02). Forward-only: there is no
-- down migration. Fix mistakes with a new numbered migration.

-- Tracks applied migrations. The migration runner also creates this table before it
-- reads the list, so this statement is a harmless no-op on a runner-managed database.
CREATE TABLE IF NOT EXISTS _schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A connected knowledge source. `config` holds non-secret settings only; secrets live
-- in Worker environment bindings.
CREATE TABLE sources (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  type           TEXT        NOT NULL CHECK (type IN ('notion', 'markdown')),
  config         JSONB       NOT NULL DEFAULT '{}',
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Normalized imported content. `content` is immutable after import; `content_hash`
-- deduplicates re-imports within a source.
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

-- Surfaced cards derived from notes. One note can have several cards of different
-- types. `is_published` gates public-mode visibility and defaults to false.
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

-- Immutable audit log of user interactions. Rows are never updated or deleted by the
-- application.
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
