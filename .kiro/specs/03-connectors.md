# Spec 03 — Knowledge Source Connectors

**Package:** `@recallfeed/connectors`
**Status:** Awaiting review
**Depends on:** `@recallfeed/core`

---

## Purpose

`@recallfeed/connectors` implements the `IConnector` interface for each supported knowledge source type. Each connector normalizes source-specific content into the uniform `Note` domain type without knowledge of the database, feed engine, or API layer.

Connectors must be:
- **Idempotent** — importing the same source twice with identical content produces identical `Note` objects.
- **Stateless** — no retained state between import calls.
- **Credential-agnostic** — receive credentials via the `ConnectorCredentials` parameter, never read environment directly.

---

## Connector Registry

The package exports a `ConnectorRegistry` that maps `SourceType` to connector instances:

```ts
import { IConnector, SourceType } from "@recallfeed/core";

class ConnectorRegistry {
  private connectors = new Map<SourceType, IConnector>();

  register(connector: IConnector): void {
    this.connectors.set(connector.type, connector);
  }

  get(type: SourceType): IConnector {
    const connector = this.connectors.get(type);
    if (!connector) {
      throw new ConnectorError(`No connector registered for type: ${type}`, "CONNECTOR_NOT_FOUND");
    }
    return connector;
  }
}

export const connectorRegistry = new ConnectorRegistry();
```

Both connectors are registered at module initialization:

```ts
// src/index.ts
import { connectorRegistry } from "./registry";
import { MarkdownConnector } from "./markdown";
import { NotionConnector } from "./notion";

connectorRegistry.register(new MarkdownConnector());
connectorRegistry.register(new NotionConnector());

export { connectorRegistry };
```

---

## Markdown Connector

### Purpose

The Markdown connector normalizes Markdown content submitted via `POST /import/markdown`. It does not read from the filesystem or fetch from URLs — the content is passed explicitly via `credentials.content`.

### Content Source

The Markdown connector receives content via the `ConnectorCredentials` parameter:

```ts
type ConnectorCredentials = {
  apiKey?: string;       // For Notion
  content?: string;      // For Markdown
};
```

When the API layer handles a Markdown import request:
1. The request body contains the Markdown content (via multipart upload or raw body).
2. The API calls `feedEngine.importMarkdown(content, { name: "..." })`.
3. The engine creates/updates a Source record and calls `connector.import(source, { content })`.
4. The connector reads from `credentials.content`, not from the source record.

**Critical:** Markdown content is passed explicitly through the call chain. It is never stored in the database or in a transient source field. The Source record only tracks metadata (name, type, last synced timestamp).

### Implementation

### Frontmatter Support

The Markdown connector supports **basic YAML frontmatter** delimited by `---`:

```markdown
---
title: "My Note"
tags: ["tag1", "tag2"]
author: "Author Name"
date: "2026-11-07"
---

# Content here
```

**Supported Fields:**
- `title` (string): Used as note title if not overridden by first heading
- `tags` (array of strings): Merged into note metadata
- `author` (string): Stored in note metadata
- `date` (ISO 8601 string): Used as `sourceCreatedAt` if provided

**Parsing:**
- Uses simple regex extraction: `/^---\n(.*?)\n---\n/s`
- Splits YAML by newlines and parses `key: value` pairs
- Does not support nested objects, arrays of objects, multiline values, or advanced YAML features
- Malformed frontmatter is treated as body content (no parse error thrown)

**This is an MVP subset.** Full YAML compliance is not required or guaranteed. If advanced frontmatter parsing is needed, an explicit parser library (e.g., `gray-matter`) should be added and documented.

---

```ts
import { IConnector, Source, NormalizedNote, ConnectorCredentials, ConnectorValidationResult, ConnectorError } from "@recallfeed/core";
import { marked } from "marked"; // Markdown parser and tokenizer

export class MarkdownConnector implements IConnector {
  readonly type = "markdown" as const;

  async validate(config: Record<string, string>, credentials: ConnectorCredentials): Promise<ConnectorValidationResult> {
    // Markdown connector has no external dependencies to validate
    return {
      valid: true,
      description: "Markdown connector ready"
    };
  }

  async import(source: Source, credentials: ConnectorCredentials): Promise<NormalizedNote[]> {
    const content = credentials.content;
    
    if (!content) {
      throw new ConnectorError(
        "Markdown connector requires content in credentials.content parameter",
        "MARKDOWN_NO_CONTENT"
      );
    }

    // Size limit: 100 KB bounds the work per request. It is an input bound, not proof of CPU compliance.
    const maxBytes = 100 * 1024;
    const sizeBytes = new TextEncoder().encode(content).length;
    
    if (sizeBytes > maxBytes) {
      throw new ConnectorError(
        `Markdown file too large: ${sizeBytes} bytes (max ${maxBytes})`,
        "MARKDOWN_TOO_LARGE"
      );
    }

    // Parse frontmatter if present
    const { frontmatter, body } = this.parseFrontmatter(content);

    // Use marked tokenizer to extract structured content
    const tokens = marked.lexer(body);
    const extractedCards = this.extractCardsFromTokens(tokens, frontmatter);

    const notes: NormalizedNote[] = extractedCards.map(card => {
      const title = card.title || frontmatter.title || null;
      const contentHash = this.hashContent(card.content);

      return {
        sourceId: source.id,
        title,
        content: card.content,
        contentHash,
        metadata: {
          tags: frontmatter.tags || [],
          author: frontmatter.author,
          sourceCreatedAt: frontmatter.date || new Date().toISOString(),
          ...card.metadata
        }
      };
    });

    return notes;
  }

  /**
   * Extract reusable card candidates from marked tokens.
   * Selection rules are independent of application context.
   */
  private extractCardsFromTokens(
    tokens: marked.TokensList,
    frontmatter: Record<string, any>
  ): Array<{ title: string | null, content: string, metadata: Record<string, any> }> {
    const cards: Array<{ title: string | null, content: string, metadata: Record<string, any> }> = [];
    let currentSection: { title: string | null, parts: string[], metadata: Record<string, any> } | null = null;

    for (const token of tokens) {
      switch (token.type) {
        case 'heading':
          // Start new section on H1 or H2
          if (token.depth <= 2) {
            if (currentSection && currentSection.parts.length > 0) {
              cards.push({
                title: currentSection.title,
                content: currentSection.parts.join('\n\n').trim(),
                metadata: currentSection.metadata
              });
            }
            currentSection = {
              title: token.text,
              parts: [],
              metadata: { headingLevel: token.depth }
            };
          } else if (currentSection) {
            // H3+ within section
            currentSection.parts.push(`${'#'.repeat(token.depth)} ${token.text}`);
          }
          break;

        case 'paragraph':
          // Initialize section for leading content if needed
          if (!currentSection) {
            currentSection = { title: null, parts: [], metadata: {} };
          }
          currentSection.parts.push(token.text);
          break;

        case 'blockquote':
          // Initialize section for leading quotes if needed
          if (!currentSection) {
            currentSection = { title: null, parts: [], metadata: { hasBlockquote: true } };
          }
          currentSection.parts.push(`> ${token.text}`);
          currentSection.metadata.hasBlockquote = true;
          break;

        case 'code':
          // Initialize section for leading code blocks if needed
          if (!currentSection) {
            currentSection = { title: null, parts: [], metadata: { hasCodeBlock: true, codeLanguage: token.lang } };
          }
          const codeBlock = `\`\`\`${token.lang || ''}\n${token.text}\n\`\`\``;
          currentSection.parts.push(codeBlock);
          currentSection.metadata.hasCodeBlock = true;
          currentSection.metadata.codeLanguage = token.lang;
          break;

        case 'list':
          // Initialize section for leading lists if needed
          if (!currentSection) {
            currentSection = { title: null, parts: [], metadata: {} };
          }
          currentSection.parts.push(this.renderList(token));
          break;
      }
    }

    // Flush final section
    if (currentSection && currentSection.parts.length > 0) {
      cards.push({
        title: currentSection.title,
        content: currentSection.parts.join('\n\n').trim(),
        metadata: currentSection.metadata
      });
    }

    return cards;
  }

  private renderList(token: marked.Tokens.List): string {
    const items = token.items.map((item: any) => {
      const marker = token.ordered ? `1.` : `-`;
      return `${marker} ${item.text}`;
    });
    return items.join('\n');
  }

  private parseFrontmatter(content: string): { frontmatter: Record<string, any>, body: string} {
    const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const [, yamlContent, body] = match;
    const frontmatter: Record<string, any> = {};

    // Simple YAML parser for common frontmatter fields
    yamlContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        frontmatter[key.trim()] = value.startsWith('[') ? 
          value.slice(1, -1).split(',').map(s => s.trim()) : 
          value;
      }
    });

    return { frontmatter, body };
  }

  private hashContent(content: string): string {
    // Use Web Crypto API (available in Workers runtime)
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = crypto.subtle.digestSync("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

### Execution Mode

**Markdown imports ALWAYS run synchronously**, even when Inngest is configured. The 100 KB size limit is chosen conservatively to reduce the risk of exceeding the free-tier 10 ms CPU budget, though actual CPU consumption depends on Markdown complexity and must be validated via benchmarks with representative content under the Workers runtime.

### Error Handling

- `MARKDOWN_NO_CONTENT` — thrown if `credentials.content` is undefined.
- `MARKDOWN_TOO_LARGE` — thrown if content exceeds 100 KB.
- Invalid Markdown syntax is never an error — the connector extracts what it can.

---

## Notion Connector

### Purpose

The Notion connector fetches pages from a Notion database and normalizes them into `Note` objects. It uses the official `@notionhq/client` SDK.

### Configuration

`source.config` for Notion sources:

```ts
{
  databaseId: string;   // Notion database ID (visible in URL)
}
```

### Credentials

The connector receives `credentials.apiKey` — the Notion integration API key from `env.NOTION_API_KEY`.

### Implementation

```ts
import { Client } from "@notionhq/client";
import { IConnector, Source, NormalizedNote, ConnectorCredentials, ConnectorValidationResult, ConnectorError } from "@recallfeed/core";

export class NotionConnector implements IConnector {
  readonly type = "notion" as const;

  async validate(config: Record<string, string>, credentials: ConnectorCredentials): Promise<ConnectorValidationResult> {
    const { databaseId } = config;
    const apiKey = credentials.apiKey;

    if (!databaseId) {
      return {
        valid: false,
        description: "",
        error: "Missing required config: databaseId"
      };
    }

    if (!apiKey) {
      return {
        valid: false,
        description: "",
        error: "Missing Notion API key"
      };
    }

    try {
      const notion = new Client({ auth: apiKey });
      const database = await notion.databases.retrieve({ database_id: databaseId });
      
      return {
        valid: true,
        description: `Notion database: ${database.title[0]?.plain_text || "Untitled"}`
      };
    } catch (error: any) {
      return {
        valid: false,
        description: "",
        error: `Notion API error: ${error.message}`
      };
    }
  }

  async import(source: Source, credentials: ConnectorCredentials): Promise<NormalizedNote[]> {
    const { databaseId } = source.config;
    const apiKey = credentials.apiKey;

    if (!databaseId) {
      throw new ConnectorError("Missing required config: databaseId", "NOTION_INVALID_CONFIG");
    }

    if (!apiKey) {
      throw new ConnectorError("Missing Notion API key", "NOTION_NO_API_KEY");
    }

    const notion = new Client({ auth: apiKey });
    const notes: NormalizedNote[] = [];

    try {
      // Query all pages in the database
      let hasMore = true;
      let startCursor: string | undefined;

      while (hasMore) {
        const response = await notion.databases.query({
          database_id: databaseId,
          start_cursor: startCursor,
          page_size: 100
        });

        for (const page of response.results) {
          if (!("properties" in page)) continue;

          // Fetch page content blocks
          const blocks = await this.getPageBlocks(notion, page.id);
          const content = this.blocksToMarkdown(blocks);
          const contentHash = this.hashContent(content);

          // Extract title from page properties
          const titleProperty = Object.values(page.properties).find(
            (prop: any) => prop.type === "title"
          ) as any;
          const title = titleProperty?.title[0]?.plain_text || null;

          notes.push({
            sourceId: source.id,
            title,
            content,
            contentHash,
            metadata: {
              externalId: page.id,
              externalUrl: page.url,
              sourceCreatedAt: page.created_time,
              sourceUpdatedAt: page.last_edited_time,
              notionProperties: this.extractProperties(page.properties)
            }
          });
        }

        hasMore = response.has_more;
        startCursor = response.next_cursor || undefined;
      }

      return notes;
    } catch (error: any) {
      throw new ConnectorError(
        `Notion import failed: ${error.message}`,
        "NOTION_IMPORT_ERROR"
      );
    }
  }

  private async getPageBlocks(notion: Client, pageId: string): Promise<any[]> {
    const blocks: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: startCursor,
        page_size: 100
      });

      blocks.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    return blocks;
  }

  private blocksToMarkdown(blocks: any[]): string {
    // Convert Notion blocks to Markdown
    // This is a simplified implementation — a production version would handle all block types
    return blocks
      .map(block => {
        if (!("type" in block)) return "";

        switch (block.type) {
          case "paragraph":
            return this.richTextToMarkdown(block.paragraph.rich_text) + "\n";
          case "heading_1":
            return `# ${this.richTextToMarkdown(block.heading_1.rich_text)}\n`;
          case "heading_2":
            return `## ${this.richTextToMarkdown(block.heading_2.rich_text)}\n`;
          case "heading_3":
            return `### ${this.richTextToMarkdown(block.heading_3.rich_text)}\n`;
          case "bulleted_list_item":
            return `- ${this.richTextToMarkdown(block.bulleted_list_item.rich_text)}\n`;
          case "numbered_list_item":
            return `1. ${this.richTextToMarkdown(block.numbered_list_item.rich_text)}\n`;
          case "code":
            const code = this.richTextToMarkdown(block.code.rich_text);
            return `\`\`\`${block.code.language}\n${code}\n\`\`\`\n`;
          default:
            return "";
        }
      })
      .join("");
  }

  private richTextToMarkdown(richText: any[]): string {
    return richText
      .map(text => {
        let content = text.plain_text;
        if (text.annotations.bold) content = `**${content}**`;
        if (text.annotations.italic) content = `*${content}*`;
        if (text.annotations.code) content = `\`${content}\``;
        return content;
      })
      .join("");
  }

  private extractProperties(properties: Record<string, any>): Record<string, any> {
    const extracted: Record<string, any> = {};

    for (const [key, prop] of Object.entries(properties)) {
      switch (prop.type) {
        case "select":
          if (prop.select) extracted[key] = prop.select.name;
          break;
        case "multi_select":
          extracted[key] = prop.multi_select.map((s: any) => s.name);
          break;
        case "date":
          if (prop.date) extracted[key] = prop.date.start;
          break;
        case "checkbox":
          extracted[key] = prop.checkbox;
          break;
        case "url":
          extracted[key] = prop.url;
          break;
      }
    }

    return extracted;
  }

  private hashContent(content: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = crypto.subtle.digestSync("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

### Execution Mode

Notion imports run **asynchronously via Inngest** when configured. If Inngest is not configured, the connector runs synchronously but with a **50-page limit** to avoid CPU timeout.

### Error Handling

- `NOTION_INVALID_CONFIG` — missing `databaseId` in `source.config`.
- `NOTION_NO_API_KEY` — missing `credentials.apiKey`.
- `NOTION_IMPORT_ERROR` — API call failure (network, permissions, invalid database ID).

---

## Package Dependencies

```json
{
  "dependencies": {
    "@recallfeed/core": "workspace:*",
    "@notionhq/client": "^2.2.15",
    "marked": "^9.1.6"
  }
}
```

---

## File Layout

```
packages/connectors/
├── src/
│   ├── registry.ts       ← ConnectorRegistry
│   ├── markdown.ts       ← MarkdownConnector
│   ├── notion.ts         ← NotionConnector
│   └── index.ts          ← Exports registry and both connectors
├── package.json
├── tsconfig.json
└── README.md
```

---

## Acceptance Criteria

- [ ] `MarkdownConnector` reads content from `credentials.content`, not from source fields.
- [ ] `MarkdownConnector` throws `MARKDOWN_NO_CONTENT` if `credentials.content` is undefined.
- [ ] `MarkdownConnector` enforces 100 KB size limit with `MARKDOWN_TOO_LARGE` error.
- [ ] `MarkdownConnector` uses `marked.lexer()` to tokenize Markdown.
- [ ] Card extraction preserves leading quotes, code blocks, lists before first heading.
- [ ] Cards with headings inside fenced code blocks handle them correctly (not treated as section breaks).
- [ ] Heading-free notes create a single card with all content.
- [ ] Card extraction rules are application-independent (no ReflectionFeed/DevRecall branches).
- [ ] Extracted cards include metadata (hasBlockquote, hasCodeBlock, codeLanguage).
- [ ] Content representation is consistent (Markdown-like text, not mixed HTML/Markdown).
- [ ] `MarkdownConnector.import()` is idempotent — same content produces same `contentHash`.
- [ ] `NotionConnector` fetches all pages from the specified database.
- [ ] `NotionConnector` converts Notion blocks to Markdown.
- [ ] `NotionConnector.import()` is idempotent — same Notion page content produces same `contentHash`.
- [ ] `ConnectorRegistry.get()` throws `CONNECTOR_NOT_FOUND` for unregistered types.
- [ ] Both connectors are registered in `src/index.ts`.
- [ ] No connector reads environment variables directly — all credentials via `ConnectorCredentials`.
- [ ] Markdown CPU consumption on Cloudflare's runtime verified for representative content. Local evidence so far (Phase 2, not Cloudflare billed CPU): parsing and hashing 100 KB took a median of 4–8 ms elapsed in local `workerd` (prose 8, code 4, mixed 6), and 4,000 tiny notes from 46 KB took 17 ms. A full local import request through `wrangler dev` used about 5 ms of `workerd` process CPU for one small note and 10–11 ms for 300 notes or 100 KB, with about 400 ms elapsed that is almost all database waiting. The 10 ms free-tier budget is therefore neither shown to be met nor shown to be exceeded. Measuring it needs a deployed Worker, which Phase 2 does not include. The 100 KB input limit and the benchmark requirement stay.
