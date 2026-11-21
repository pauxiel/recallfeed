## Postgres: read the plan before adding an index

**`EXPLAIN (ANALYZE, BUFFERS)` shows what actually happened; guessing which index helps wastes both.** Look for a sequential scan on a large table, a row estimate far from the actual count, and a sort that spills to disk.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM feed_items
WHERE is_published AND snoozed_until IS NULL
ORDER BY created_at
LIMIT 20;
```

A partial index such as `WHERE is_published` stays small and fits a query that always filters on it.

## Postgres: keyset pagination

**`OFFSET` rereads every skipped row; a keyset condition jumps straight to the next page.** Order by a unique, total key, then ask for rows after the last one you returned.

```sql
SELECT id, created_at FROM feed_items
WHERE (created_at, id) > ($1, $2)
ORDER BY created_at, id
LIMIT 21;
```

Fetch one extra row. If it comes back, there is another page, and you do not need a count query.

## ADR: store review events as an immutable log

**Decision:** every review action appends a row to `review_events` and never updates or deletes one.

**Why:** the card keeps only its current state, so a log is the only way to answer what happened and when. An append-only table is easy to reason about, safe under concurrent writers, and cheap to audit.

**Cost:** the table grows without bound. Accept that now and partition by month if it becomes a problem.

## ADR: public reads return an allow-list of fields

**Decision:** a public response is built from a short list of named fields, not by deleting the private ones.

**Why:** with a deny-list, a column added later is exposed by default. With an allow-list, a new column stays private until someone adds it on purpose.

**Cost:** adding a public field is a deliberate, reviewed change. That is the point.
