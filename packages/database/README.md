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
with its `_schema_migrations` row, so a failed file leaves nothing behind. The Node entry
point (`migrate-node.ts`, `migrate-cli.ts`) uses a WebSocket connection because the HTTP
`neon()` function cannot run multi-statement files or transactions. It never runs in a Worker.

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
- The setup **drops and recreates the `public` schema**. `assertSafeTestDatabaseUrl` refuses
  any host except `localhost`, `127.0.0.1`, `::1`, and `db.localtest.me`, and any database
  name that does not contain `test` as a whole word.
- `db.localtest.me` resolves to `127.0.0.1` through public DNS, so first use needs internet.
  Working offline needs a hosts-file entry, which is a privileged change.
- The proxy image is a community project, not Neon's. It gives high but not perfect parity
  with hosted Neon. Re-verify against a real Neon branch before relying on edge behavior.
- The `postgres:postgres` credentials guard a throwaway loopback database and are not secrets.

## Coverage

The root coverage run measures what executes inside the Workers test process. The Node-only
files (`*-node.ts`, `*-cli.ts`, and test setup) cannot be instrumented there, so they are
excluded in `vitest.config.ts` and verified by running them: the CLI against a reset database,
and the integration suite, which depends on the global setup.
