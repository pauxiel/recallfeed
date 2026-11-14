# @recallfeed/connectors

Knowledge-source connectors for RecallFeed. Each connector turns source content into
`NormalizedNote` objects and knows nothing about the database, the feed engine, or any
application. Specification: [`.kiro/specs/03-connectors.md`](../../.kiro/specs/03-connectors.md).

Depends only on `@recallfeed/core` and `marked`.

## Public API

| Export | Purpose |
|---|---|
| `connectorRegistry`, `ConnectorRegistry` | Maps a source type to its connector. `get()` throws `CONNECTOR_NOT_FOUND` for an unregistered type. |
| `MarkdownConnector` | Parses Markdown into notes. Registered on import. |
| `MARKDOWN_MIN_BYTES`, `MARKDOWN_MAX_BYTES` | The import size bounds (10 bytes, 100 KB). |
| `parseFrontmatter`, `sha256Hex` | The helpers the connector uses. |

Only Markdown exists today. The Notion connector is deferred to Gate 4.

## How Markdown becomes notes

The text comes in as `credentials.content`. It is never read from the filesystem, the network, or
the database, and the connector reads no environment variables.

- A level 1 or 2 heading starts a new note. Content before the first heading becomes its own note.
- A heading inside a fenced code block is code, not a section break.
- Level 3 and deeper headings stay inside their note. A section with no body produces no note.
- Lists, quotes, code blocks, and tables are kept as Markdown text. HTML and horizontal rules are dropped.
- `title`, `tags`, `author`, and `date` frontmatter (simple `key: value` lines) are supported. Frontmatter
  with no recognized field is treated as body text.
- `contentHash` is the SHA-256 of the note content. The same text always gives the same notes,
  hashes, and metadata. Nothing depends on the clock.
- `MARKDOWN_NO_CONTENT` for missing content, `MARKDOWN_TOO_LARGE` for more than 100 KB (measured in
  bytes). Odd or malformed Markdown is never an error.

### Where this differs from the Spec 03 sketch, and why

- `crypto.subtle.digestSync` does not exist in Workers. The asynchronous `digest` is used.
- `sourceCreatedAt` is set only when the document has a `date`. The sketch falls back to the current
  time, which makes two imports of the same text differ.
- Multi-line quotes get `> ` on every line, and fences grow when the code contains backticks.
- A level 3 or deeper heading before any section is kept, and tables are kept. The sketch drops both.
- `marked` is 18.x, not the sketch's 9.x. The token shapes this code reads are the same in both.

### A limit of the dependency

The `marked` lexer recurses once per nesting level. A few kilobytes of nested blockquote or list
markers (about 2,000 `>` or 10,000 `- `) overflow the call stack. The connector catches exactly that
`RangeError` and keeps the text as one plain note instead of failing, because this runs behind a
public endpoint. The nesting is not interpreted in that case.

## Performance

`src/__tests__/markdown.bench.test.ts` logs parse-and-hash time per size. Those are elapsed
milliseconds in the **local** Workers runtime, not Cloudflare's billed CPU time, and they exclude the
rest of an import. The 100 KB bound limits input size; it does not by itself show that the free-tier
CPU budget is met.
