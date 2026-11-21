# @recallfeed/client

A typed client for the RecallFeed HTTP API (Spec 05), for frontends, scripts and CLIs. It depends only on
`@recallfeed/core` and the platform's `fetch`, so it runs in browsers, Workers and Node. It has no
knowledge of any application built on the skeleton.

## Use

```ts
import { createRecallFeedClient } from "@recallfeed/client";

// A public deployment, from a browser: no key.
const feed = createRecallFeedClient({ baseUrl: "https://my-api.example.workers.dev" });
const page = await feed.listFeed({ limit: 20 });
const next = page.nextCursor ? await feed.listFeed({ limit: 20, cursor: page.nextCursor }) : null;

// An admin script, server-side only: the key comes from the environment.
const admin = createRecallFeedClient({ baseUrl: process.env.API_URL ?? "", apiKey: process.env.API_SECRET_KEY });
await admin.importMarkdown(markdown, { name: "notes" });
```

## Public API

| Export | Purpose |
|---|---|
| `createRecallFeedClient({ baseUrl, apiKey?, headers?, fetch? })` | `baseUrl` is the API's URL or a same-origin path such as `/api`; a trailing slash is ignored. `apiKey` is sent as `X-API-Key`. |
| `client.listFeed({ limit?, cursor? })` | `GET /feed`, returning `{ items, nextCursor }`. Use `listFeed<OwnerCard>()` when the caller is the owner or holds the key. |
| `client.getCard(id)` | `GET /feed/:id`. |
| `client.importMarkdown(content, { name? })` | `POST /import/markdown` (JSON). Needs write access. |
| `client.review(id, action)` | `PUT /feed/:id/review` with one of the six review actions. Needs write access. |
| `RecallFeedApiError` | Every failure. It extends core's `RecallFeedError` and has `code` and `status`. |
| `PublicCard`, `OwnerCard`, `CardPage`, `ImportMarkdownResult`, `ReviewResult` | Response types. Dates are ISO 8601 strings. |

## Errors

- **The API's own errors** keep its message, `code` (for example `AUTH_API_KEY_MISSING`) and status.
- **`CLIENT_BAD_RESPONSE`** means the body was not a RecallFeed response, such as a proxy's HTML error
  page or a page without `items`.
- **`CLIENT_NETWORK`** (status 0) means no response arrived. The underlying error is not passed on.

## Security

- **Never use `apiKey` in browser code.** Anything shipped to a browser is public. Creating a client with
  a key where `window` and `document` exist throws `CLIENT_API_KEY_IN_BROWSER`. This guard catches
  mistakes; it does not replace keeping the key out of frontend bundles.
- **Private deployments** behind Cloudflare Access authenticate with the Access cookie, which a
  same-origin browser request sends automatically. Writes from a script must also send the deployment's
  own `Origin` (the API's CSRF rule), for example `headers: { Origin: baseUrl }`.
