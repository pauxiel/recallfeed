# @recallfeed/database

PostgreSQL schema, migrations, and the Neon client factory for RecallFeed.
Specification: [`.kiro/specs/02-database-schema.md`](../../.kiro/specs/02-database-schema.md).

Depends on `@recallfeed/core` and `@neondatabase/serverless`. It knows nothing about any
application built on the skeleton.

## Status

Only part of Spec 02 exists so far (Phase 2, Tasks 8 to 10): the client factory, migration
`001_initial.sql`, the migration runner, and the test database. Typed query functions
(`queries/`) and seeds come in later tasks.

## Public API

Exported from `src/index.ts`.

| Export | Purpose |
|---|---|
| `createDb(databaseUrl)` | Request-scoped Neon SQL client over HTTP. Call it inside a handler with `env.DATABASE_URL`, never at module load. No pooling, retry wrapper, or transaction helper in the MVP. |
| `DbClient`, `DatabaseEnv` | Types for the client and the `DATABASE_URL` binding. |

Use `sql.query(text, params)` for parameterized queries built from strings.

## Migrations

Numbered files in `src/migrations/` named `NNN_description.sql`, sorted by **numeric** prefix.
They are forward-only; fix mistakes with a new migration.

```sh
DATABASE_URL=postgres://... pnpm --filter @recallfeed/database db:migrate
```

The runner (`src/migrate.ts`) applies each unapplied file in its own transaction together
with its `_schema_migrations` row, so a failed file leaves nothing behind.

The Node entry point (`migrate-node.ts`, `migrate-cli.ts`) opens a WebSocket **session** on
purpose. The HTTP `neon()` function does support transactions, but only as a non-interactive
batch of single statements (`sql.transaction([...])`). A migration file holds several
statements, and the HTTP function rejects those ("cannot insert multiple commands into a
prepared statement", checked against PostgreSQL 17.12 on 2026-11-14). It also cannot hold an
interactive `BEGIN ... COMMIT` open across calls, because each HTTP call is stateless. A
session has neither limit. The runner never runs in a Worker.

## Test database

Integration tests need a disposable PostgreSQL 17 behind a Neon-compatible HTTP proxy.
`docker/compose.test.yaml` runs both from digest-pinned images.

```sh
pnpm --filter @recallfeed/database db:test:up          # start (needs Docker, for example Colima)
pnpm --filter @recallfeed/database test:integration    # run all tests against it
pnpm --filter @recallfeed/database db:test:down        # stop and discard the data
```

- Without `TEST_DATABASE_URL`, the integration suites are **skipped**, so `pnpm test` never
  needs an external service. A skipped run is not a pass: check the skipped count.
- The proxy listens on `127.0.0.1:4444` only. PostgreSQL publishes no port, and its data is
  on tmpfs. Keep development data in a separate compose project, volume, and ports.
- The setup **drops and recreates the `public` schema**, so it refuses to start unless all
  three gates pass:
  1. `assertSafeTestDatabaseUrl`: the host is `localhost`, `127.0.0.1`, `::1`, or
     `db.localtest.me`; the database is exactly `recallfeed_test`; and the URL has **no query
     parameters or fragment** (the Neon driver lets `?host=` override the host).
  2. `assertDriverTargetMatchesUrl`: the host, port, and database the driver will use equal
     the URL's, checked on an unconnected client.
  3. `assertDisposableFixture`: on the live session, `current_database()` is
     `recallfeed_test` **and** the database carries the comment written by
     `docker/init-test-fixture.sql` when the container was created. A database that was not
     created as the fixture has no such comment and is never reset.
- Unencrypted WebSocket access to the proxy is configured **per client**, only when that
  client's host is exactly `db.localtest.me`, and it refuses any other host. Nothing is left
  in the process-wide Neon config. HTTP routing is process-wide because the driver offers no
  per-client option; it answers only for `db.localtest.me` and delegates every other host to
  the driver's default endpoint.
- `db.localtest.me` resolves to `127.0.0.1` through public DNS, so first use needs internet.
  Working offline needs a hosts-file entry, which is a privileged change.
- The proxy image is a community project, not Neon's. It gives high but not perfect parity
  with hosted Neon. Re-verify against a real Neon branch before relying on edge behavior.
- The `postgres:postgres` credentials guard a throwaway loopback database and are not secrets.

## Tests and coverage

Two Vitest projects: `vitest.config.ts` runs `*.test.ts` in the Workers runtime (workerd), and
`vitest.node.config.ts` runs `*.node.test.ts` in plain Node. `pnpm test` runs both. Without
`TEST_DATABASE_URL` the database-backed suites skip, so an ordinary green `pnpm test` is **not**
full database validation. Run `test:integration` for that and look at the skipped count.

Coverage is collected in both projects. Only `*-cli.ts` entry points are excluded, because they
are separate processes that call `process.exit()`. They are verified by running them
(`pnpm db:migrate`). The global setup is excluded as a test file and is exercised by every
integration run.
