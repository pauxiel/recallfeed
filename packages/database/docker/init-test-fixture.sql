-- Marks recallfeed_test as the disposable test fixture.
--
-- PostgreSQL runs this once, when the container creates its (empty, tmpfs) data directory.
-- The test setup refuses to drop or recreate any schema in a database that lacks this exact
-- comment, so a database that was not created by compose.test.yaml can never be reset.
-- A database comment is stored outside the `public` schema, so resetting the schema keeps it.
--
-- Keep the text in sync with FIXTURE_MARKER in src/test-fixture.ts. A test compares them.
COMMENT ON DATABASE recallfeed_test IS 'recallfeed-disposable-test-fixture:v1';
