## Idempotency keys

**Idempotency keys make retries safe.** A client generates one key per logical operation and sends it with every attempt. The server stores the key with the result, and a repeat returns the stored result instead of acting twice.

```http
POST /payments
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

Keep keys for at least as long as clients can retry. Scope them to the caller, so one tenant cannot replay another's key.

## The outbox pattern

**Write the event in the same transaction as the state change.** A service that updates its database and then publishes to a queue can crash between the two. Instead, insert the event into an `outbox` table inside the transaction, and let a separate relay publish rows and mark them sent.

The relay can publish a row twice, so consumers must be idempotent. At-least-once delivery plus idempotent handling gives effectively-once behavior.

## Timeouts, retries and jitter

**A retry without jitter is a synchronized stampede.** When a dependency recovers, every client that backed off the same way retries at the same moment. Add randomness to the delay:

```ts
function backoffMs(attempt: number, baseMs = 100, capMs = 10_000): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.random() * ceiling; // "full jitter"
}
```

Retry only operations that are safe to repeat, set a total deadline, and stop retrying when the dependency is clearly down.

## Why clocks lie

**Never order events across machines by wall-clock time.** Clocks drift, jump after sync, and differ between hosts. Use a logical clock (a counter that moves forward on every event) or let one database assign the order. When you must compare timestamps, expect skew and allow for it.
