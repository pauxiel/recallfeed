import type { ReviewAction } from "@recallfeed/core";
import { RecallFeedApiError } from "./errors";
import type { CardPage, ImportMarkdownResult, PublicCard, ReviewResult } from "./types";

/** The `fetch` the client calls. Defaults to the global one. */
export type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

/** How to reach one RecallFeed deployment. */
export type RecallFeedClientOptions = {
  /**
   * The API's base URL, such as `https://my-api.example.workers.dev`, or a same-origin path such as
   * `/api`. A trailing slash is ignored.
   */
  baseUrl: string;
  /**
   * The deployment's `API_SECRET_KEY`, sent as `X-API-Key` on every request. **Server-side code only**
   * (scripts, CLIs, server components). A client created with a key in a browser throws, because anything
   * shipped to a browser is public.
   */
  apiKey?: string;
  /** Extra headers on every request, such as `Origin` for a script writing to a private deployment. */
  headers?: Record<string, string>;
  /** Replaces the global `fetch`, for tests or custom transports. */
  fetch?: FetchFunction;
};

/** Options for one page of the feed. */
export type ListFeedOptions = {
  /** 1 to 50; the API's default is 10. */
  limit?: number;
  /** The previous page's `nextCursor`. */
  cursor?: string;
};

/** A typed client for the RecallFeed HTTP API (Spec 05). Every method throws {@link RecallFeedApiError}. */
export type RecallFeedClient = {
  /**
   * `GET /feed`: one page of cards in the deployment's order. Public deployments return
   * {@link PublicCard}s; the owner of a private deployment gets `OwnerCard`s.
   */
  listFeed<TCard extends PublicCard = PublicCard>(options?: ListFeedOptions): Promise<CardPage<TCard>>;
  /** `GET /feed/:id`: one card. A public deployment answers 404 for an unpublished card. */
  getCard<TCard extends PublicCard = PublicCard>(id: string): Promise<TCard>;
  /** `POST /import/markdown`. Needs write access: the API key (public) or the owner (private). */
  importMarkdown(content: string, options?: { name?: string }): Promise<ImportMarkdownResult>;
  /** `PUT /feed/:id/review`. Needs write access, like {@link RecallFeedClient.importMarkdown}. */
  review(id: string, action: ReviewAction): Promise<ReviewResult>;
};

function isBrowser(): boolean {
  const scope = globalThis as { window?: unknown; document?: unknown };
  return typeof scope.window === "object" && scope.window !== null && typeof scope.document === "object";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function badResponse(status: number): RecallFeedApiError {
  return new RecallFeedApiError("The API returned an unexpected response", "CLIENT_BAD_RESPONSE", status);
}

/**
 * Creates a client for one deployment.
 *
 * @param options - The base URL, and optionally a server-side API key, headers or `fetch`.
 * @returns The client.
 * @throws RecallFeedApiError `CLIENT_API_KEY_IN_BROWSER` if an API key is given in a browser.
 */
export function createRecallFeedClient(options: RecallFeedClientOptions): RecallFeedClient {
  if (options.apiKey !== undefined && isBrowser()) {
    throw new RecallFeedApiError("An API key must never be used in browser code", "CLIENT_API_KEY_IN_BROWSER", 0);
  }
  const base = options.baseUrl.replace(/\/+$/, "");
  const send: FetchFunction = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function request(method: string, path: string, body?: { type: string; data: string }): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
    if (options.apiKey !== undefined) headers["X-API-Key"] = options.apiKey;
    if (body !== undefined) headers["Content-Type"] = body.type;

    let response: Response;
    try {
      response = await send(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body: body.data }) });
    } catch {
      // The underlying error is not passed on: some runtimes put request details in it.
      throw new RecallFeedApiError("The API could not be reached", "CLIENT_NETWORK", 0);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await response.text());
    } catch {
      throw badResponse(response.status);
    }
    if (!response.ok) {
      if (isRecord(parsed) && typeof parsed.error === "string" && typeof parsed.code === "string") {
        throw new RecallFeedApiError(parsed.error, parsed.code, response.status);
      }
      throw badResponse(response.status);
    }
    return parsed;
  }

  return {
    async listFeed<TCard extends PublicCard = PublicCard>(listOptions: ListFeedOptions = {}): Promise<CardPage<TCard>> {
      const query = new URLSearchParams();
      if (listOptions.limit !== undefined) query.set("limit", String(listOptions.limit));
      if (listOptions.cursor !== undefined) query.set("cursor", listOptions.cursor);
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      const page = await request("GET", `/feed${suffix}`);
      if (!isRecord(page) || !Array.isArray(page.items) || !(page.nextCursor === null || typeof page.nextCursor === "string")) {
        throw badResponse(200);
      }
      return page as CardPage<TCard>;
    },

    async getCard<TCard extends PublicCard = PublicCard>(id: string): Promise<TCard> {
      const card = await request("GET", `/feed/${encodeURIComponent(id)}`);
      if (!isRecord(card) || typeof card.id !== "string") throw badResponse(200);
      return card as TCard;
    },

    async importMarkdown(content: string, importOptions: { name?: string } = {}): Promise<ImportMarkdownResult> {
      const data = JSON.stringify(importOptions.name === undefined ? { content } : { content, name: importOptions.name });
      const result = await request("POST", "/import/markdown", { type: "application/json", data });
      if (!isRecord(result) || typeof result.sourceId !== "string") throw badResponse(200);
      return result as ImportMarkdownResult;
    },

    async review(id: string, action: ReviewAction): Promise<ReviewResult> {
      const result = await request("PUT", `/feed/${encodeURIComponent(id)}/review`, {
        type: "application/json",
        data: JSON.stringify({ action }),
      });
      if (!isRecord(result) || typeof result.id !== "string") throw badResponse(200);
      return result as ReviewResult;
    },
  };
}
