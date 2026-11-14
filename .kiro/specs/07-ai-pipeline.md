# Spec 07 — AI Pipeline

**Package:** `@recallfeed/ai`
**Status:** Approved
**Depends on:** Spec 01 (core domain), Spec 06 (Inngest workflows)

---

## Purpose

`@recallfeed/ai` provides optional AI enrichment for imported notes. It implements the `IAIProvider` interface from `@recallfeed/core` through two adapters: Cloudflare Workers AI and Anthropic Claude.

AI enrichment is strictly additive and asynchronous. It never blocks note import or feed delivery. Original notes are always preserved and remain accessible regardless of whether AI processing has run. Deploying RecallFeed without any AI credentials must work perfectly.

---

## Design Constraints

- AI enrichment always runs asynchronously via the Inngest `ai-enrichment-workflow` (Spec 06).
- AI-generated content is stored as separate `FeedItem` records with `is_ai_generated = true`.
- The original `FeedItem` with `card_type = "original"` is never modified by AI.
- Both adapters implement the same `IAIProvider` interface — callers cannot distinguish between them.
- If an AI provider returns `null` (content unsuitable, quota exceeded, model unavailable), the workflow skips that enrichment type silently. No error is surfaced to the user.
- AI is disabled when both `env.ANTHROPIC_API_KEY` and `env.AI` are absent.

---

## `IAIProvider` Interface Reminder

From `@recallfeed/core`:

```ts
interface IAIProvider {
  readonly name: string;
  summarize(content: string, options?: AIOptions): Promise<string | null>;
  generateReflectionPrompt(content: string, options?: AIOptions): Promise<string | null>;
}
```

---

## Provider Resolution

```ts
// packages/ai/src/resolve-provider.ts

export function resolveAIProvider(env: {
  ANTHROPIC_API_KEY?: string;
  AI?: Ai;
}): IAIProvider | null {
  if (env.ANTHROPIC_API_KEY) return new ClaudeAdapter(env.ANTHROPIC_API_KEY);
  if (env.AI) return new WorkersAIAdapter(env.AI);
  return null;
}
```

Anthropic Claude takes precedence over Workers AI when both are configured. This preference is documented and configurable via `AI_PROVIDER=workers-ai` environment variable to force Workers AI even when `ANTHROPIC_API_KEY` is set.

---

## Adapter 1: Cloudflare Workers AI

```ts
// packages/ai/src/workers-ai-adapter.ts

class WorkersAIAdapter implements IAIProvider {
  readonly name = "workers-ai";

  constructor(private readonly ai: Ai) {}

  async summarize(content: string, options?: AIOptions): Promise<string | null> {
    if (content.length < 50) return null;  // Too short to summarize meaningfully

    const truncated = content.slice(0, 3000);  // Workers AI context limit
    try {
      const result = await this.ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: "Summarize the following note in 2-3 concise sentences. Focus on the key insight or most important idea. Return only the summary text.",
          },
          { role: "user", content: truncated },
        ],
        max_tokens: 200,
      });
      return result.response?.trim() ?? null;
    } catch {
      return null;
    }
  }

  async generateReflectionPrompt(content: string, options?: AIOptions): Promise<string | null> {
    if (content.length < 50) return null;

    const truncated = content.slice(0, 3000);
    try {
      const result = await this.ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: "Generate one thoughtful reflection question based on the following note. The question should encourage deeper thinking or personal application. Return only the question.",
          },
          { role: "user", content: truncated },
        ],
        max_tokens: 100,
      });
      return result.response?.trim() ?? null;
    } catch {
      return null;
    }
  }
}
```

**Workers AI and free-tier CPU:** The `this.ai.run()` call is an HTTP subrequest to Cloudflare's AI infrastructure — I/O-bound, not CPU-bound. CPU cost is near-zero. However, the Workers AI binding is only available when the `AI` binding is configured in `wrangler.toml`.

**Workers AI inside Inngest steps:** Each `this.ai.run()` call executes inside a `step.run()` in the Inngest function. The step is subject to Worker CPU limits. Since the call is I/O-bound, this is safe on both free and paid tiers.

---

## Adapter 2: Anthropic Claude

```ts
// packages/ai/src/claude-adapter.ts

class ClaudeAdapter implements IAIProvider {
  readonly name = "claude";
  private static readonly MODEL = "claude-haiku-4-5";  // Lowest cost, fastest

  constructor(private readonly apiKey: string) {}

  async summarize(content: string, options?: AIOptions): Promise<string | null> {
    if (content.length < 50) return null;

    const truncated = content.slice(0, 8000);  // Claude's context is larger
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: ClaudeAdapter.MODEL,
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `Summarize the following note in 2-3 concise sentences. Return only the summary.\n\n${truncated}`,
          }],
        }),
      });

      if (!response.ok) return null;
      const data = await response.json() as { content?: { text: string }[] };
      return data.content?.[0]?.text?.trim() ?? null;
    } catch {
      return null;
    }
  }

  async generateReflectionPrompt(content: string, options?: AIOptions): Promise<string | null> {
    if (content.length < 50) return null;

    const truncated = content.slice(0, 8000);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: ClaudeAdapter.MODEL,
          max_tokens: 100,
          messages: [{
            role: "user",
            content: `Generate one thoughtful reflection question based on this note. Return only the question.\n\n${truncated}`,
          }],
        }),
      });

      if (!response.ok) return null;
      const data = await response.json() as { content?: { text: string }[] };
      return data.content?.[0]?.text?.trim() ?? null;
    } catch {
      return null;
    }
  }
}
```

---

## Inngest AI Enrichment Workflow (Full Definition)

Extending the stub from Spec 06:

```ts
// packages/api/src/inngest/ai-enrichment-workflow.ts

export const aiEnrichmentFunction = inngest.createFunction(
  {
    id: "ai-enrichment",
    triggers: { event: "recallfeed/note.enrich" },
    retries: 2,
    rateLimit: { limit: 1, period: "5s", key: "event.data.noteId" },
  },
  async ({ event, step, env }) => {
    const { noteId } = event.data;
    const db = createDb(env.DATABASE_URL);

    const provider = resolveAIProvider(env);
    if (!provider) return { skipped: true, reason: "No AI provider configured" };

    const note = await step.run("fetch-note", async () => {
      const n = await getNoteById(db, noteId);
      if (!n) throw new NotFoundError(`Note not found: ${noteId}`, "NOT_FOUND_NOTE");
      return n;
    });

    // Check if AI cards already exist — avoid duplicates on retry
    const existingSummary = await step.run("check-existing-summary", async () => {
      return getFeedItemByNoteAndType(db, noteId, "summary");
    });

    if (!existingSummary) {
      const summary = await step.run("generate-summary", async () => {
        return provider.summarize(note.content);
      });

      if (summary) {
        await step.run("save-summary", async () => {
          await createFeedItem(db, {
            noteId,
            sourceId: note.sourceId,
            cardType: "summary",
            content: summary,
            isAiGenerated: true,
            isPublished: false,
          });
        });
      }
    }

    const existingPrompt = await step.run("check-existing-prompt", async () => {
      return getFeedItemByNoteAndType(db, noteId, "reflection_prompt");
    });

    if (!existingPrompt) {
      const prompt = await step.run("generate-reflection-prompt", async () => {
        return provider.generateReflectionPrompt(note.content);
      });

      if (prompt) {
        await step.run("save-reflection-prompt", async () => {
          await createFeedItem(db, {
            noteId,
            sourceId: note.sourceId,
            cardType: "reflection_prompt",
            content: prompt,
            isAiGenerated: true,
            isPublished: false,
          });
        });
      }
    }

    return { noteId, provider: provider.name };
  }
);
```

**Idempotency:** The workflow checks for existing AI cards before generating new ones. This ensures retries (from Inngest) do not create duplicate AI-generated cards. The `getFeedItemByNoteAndType` query enforces uniqueness.

---

## Content Limits

| Provider | Max input length | Notes |
|---|---|---|
| Workers AI | 3,000 characters | Context window constraint |
| Anthropic Claude | 8,000 characters | Claude Haiku context |

Content is truncated to these limits before sending. The original note content in the database is never modified.

---

## Testing Without AI Credentials

A `MockAIProvider` is provided for tests and local development:

```ts
// packages/ai/src/mock-provider.ts

export class MockAIProvider implements IAIProvider {
  readonly name = "mock";

  async summarize(content: string): Promise<string | null> {
    return `[Mock summary of ${content.length} characters]`;
  }

  async generateReflectionPrompt(content: string): Promise<string | null> {
    return "[Mock reflection prompt] What was the most surprising insight from this note?";
  }
}
```

Tests inject `MockAIProvider` directly instead of calling `resolveAIProvider`.

---

## File Layout

```
packages/ai/
├── src/
│   ├── workers-ai-adapter.ts
│   ├── claude-adapter.ts
│   ├── mock-provider.ts
│   ├── resolve-provider.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Acceptance Criteria

- [ ] `resolveAIProvider` returns `null` when both `ANTHROPIC_API_KEY` and `AI` are absent.
- [ ] `resolveAIProvider` returns `ClaudeAdapter` when `ANTHROPIC_API_KEY` is set.
- [ ] `resolveAIProvider` returns `WorkersAIAdapter` when only `AI` binding is set.
- [ ] Both adapters return `null` for content shorter than 50 characters.
- [ ] Both adapters return `null` on network failure or non-OK API response (no thrown errors).
- [ ] AI enrichment workflow checks for existing cards before generating — no duplicates on retry.
- [ ] AI-generated feed items have `is_ai_generated = true`.
- [ ] AI-generated feed items have `is_published = false` by default.
- [ ] `MockAIProvider` can replace either real adapter in tests.
- [ ] No AI credentials appear in any log statement, error message, or Inngest event payload.
- [ ] TypeScript compilation passes with `strict: true`.
