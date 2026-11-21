import { RecallFeedError } from "@recallfeed/core";
import { afterEach, describe, expect, it } from "vitest";
import { RecallFeedApiError, createRecallFeedClient } from "../index";
import type { FetchFunction, OwnerCard } from "../index";

type Sent = { url: string; method: string; headers: Record<string, string>; body: string | undefined };

/** A stand-in fetch that records each request and answers with the given status and body. */
function fakeFetch(status: number, body: unknown): FetchFunction & { sent: Sent[] } {
  const sent: Sent[] = [];
  const fn = (async (input: string, init?: RequestInit) => {
    sent.push({
      url: input,
      method: init?.method ?? "GET",
      headers: { ...(init?.headers as Record<string, string>) },
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as FetchFunction & { sent: Sent[] };
  fn.sent = sent;
  return fn;
}

const PAGE = {
  items: [{ id: "c1", noteId: "n1", cardType: "original", content: "A note", isAiGenerated: false, createdAt: "2026-11-21T00:00:00.000Z" }],
  nextCursor: "next-page",
};

async function rejection(promise: Promise<unknown>): Promise<RecallFeedApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RecallFeedApiError) return error;
    throw error;
  }
  throw new Error("expected a rejection");
}

describe("createRecallFeedClient", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
  });

  it("listFeed sends GET /feed with limit and cursor, and returns the page", async () => {
    const fetch = fakeFetch(200, PAGE);
    const client = createRecallFeedClient({ baseUrl: "https://api.example.test/", fetch });

    const page = await client.listFeed({ limit: 5, cursor: "abc+/=" });

    expect(page).toEqual(PAGE);
    expect(fetch.sent).toEqual([
      { url: "https://api.example.test/feed?limit=5&cursor=abc%2B%2F%3D", method: "GET", headers: { Accept: "application/json" }, body: undefined },
    ]);
  });

  it("listFeed without options sends no query string, and a same-origin path works as the base", async () => {
    const fetch = fakeFetch(200, { items: [], nextCursor: null });

    await createRecallFeedClient({ baseUrl: "/api", fetch }).listFeed();

    expect(fetch.sent.map((s) => s.url)).toEqual(["/api/feed"]);
  });

  it("listFeed can be typed as owner cards", async () => {
    const fetch = fakeFetch(200, { items: [{ ...PAGE.items[0], reviewCount: 2 }], nextCursor: null });

    const page = await createRecallFeedClient({ baseUrl: "/api", fetch }).listFeed<OwnerCard>();

    expect(page.items[0]?.reviewCount).toBe(2);
  });

  it("getCard sends GET /feed/:id with the id encoded", async () => {
    const fetch = fakeFetch(200, PAGE.items[0]);

    const card = await createRecallFeedClient({ baseUrl: "https://api.example.test", fetch }).getCard("a/b?c");

    expect(card.id).toBe("c1");
    expect(fetch.sent[0]?.url).toBe("https://api.example.test/feed/a%2Fb%3Fc");
  });

  it("importMarkdown posts JSON with the content and name, and sends the API key", async () => {
    const result = { sourceId: "s1", queued: false, notesImported: 2, feedItemsCreated: 3, feedItemIds: ["c1", "c2", "c3"] };
    const fetch = fakeFetch(200, result);
    const client = createRecallFeedClient({ baseUrl: "https://api.example.test", apiKey: "k-123", fetch });

    expect(await client.importMarkdown("# Note\n\nBody", { name: "notes" })).toEqual(result);
    expect(fetch.sent[0]).toEqual({
      url: "https://api.example.test/import/markdown",
      method: "POST",
      headers: { Accept: "application/json", "X-API-Key": "k-123", "Content-Type": "application/json" },
      body: JSON.stringify({ content: "# Note\n\nBody", name: "notes" }),
    });
  });

  it("importMarkdown without a name sends only the content", async () => {
    const fetch = fakeFetch(200, { sourceId: "s1", queued: false, notesImported: 1, feedItemsCreated: 1, feedItemIds: ["c1"] });

    await createRecallFeedClient({ baseUrl: "/api", fetch }).importMarkdown("# One\n\nBody");

    expect(JSON.parse(fetch.sent[0]?.body ?? "")).toEqual({ content: "# One\n\nBody" });
  });

  it.each([
    ["no feedItemIds (an older API)", { sourceId: "s1", queued: false, notesImported: 1, feedItemsCreated: 1 }],
    ["feedItemIds that is not a list", { sourceId: "s1", queued: false, notesImported: 1, feedItemsCreated: 1, feedItemIds: "c1" }],
    ["feedItemIds with a non-string", { sourceId: "s1", queued: false, notesImported: 1, feedItemsCreated: 1, feedItemIds: ["c1", 2] }],
  ])("importMarkdown refuses a response with %s, rather than reporting no new cards", async (_label, body) => {
    const error = await rejection(createRecallFeedClient({ baseUrl: "/api", fetch: fakeFetch(200, body) }).importMarkdown("# A\n\nB"));

    expect(error.code).toBe("CLIENT_BAD_RESPONSE");
  });

  it("an empty feedItemIds is a valid answer: a repeat import created nothing", async () => {
    const body = { sourceId: "s1", queued: false, notesImported: 1, feedItemsCreated: 0, feedItemIds: [] };

    expect(await createRecallFeedClient({ baseUrl: "/api", fetch: fakeFetch(200, body) }).importMarkdown("# A\n\nB")).toEqual(body);
  });

  it("review sends PUT /feed/:id/review with the action, plus any extra headers", async () => {
    const result = { id: "c1", reviewCount: 1, lastReviewedAt: "2026-11-21T00:00:00.000Z", savedAt: null, snoozedUntil: null, isPublished: false };
    const fetch = fakeFetch(200, result);
    const client = createRecallFeedClient({ baseUrl: "https://api.example.test", headers: { Origin: "https://api.example.test" }, fetch });

    expect(await client.review("c1", "reviewed")).toEqual(result);
    expect(fetch.sent[0]).toMatchObject({
      url: "https://api.example.test/feed/c1/review",
      method: "PUT",
      headers: { Origin: "https://api.example.test", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reviewed" }),
    });
  });

  it("an API error becomes RecallFeedApiError with the API's message, code and status", async () => {
    const fetch = fakeFetch(401, { error: "X-API-Key header required", code: "AUTH_API_KEY_MISSING" });

    const error = await rejection(createRecallFeedClient({ baseUrl: "/api", fetch }).importMarkdown("# A\n\nB"));

    expect(error).toBeInstanceOf(RecallFeedError);
    expect([error.message, error.code, error.status]).toEqual(["X-API-Key header required", "AUTH_API_KEY_MISSING", 401]);
  });

  it.each([
    ["a non-JSON error page", 502, "<html>Bad gateway</html>"],
    ["an error without a code", 500, { message: "oops" }],
    ["a success that is not JSON", 200, "not json"],
    ["a feed page without items", 200, { nextCursor: null }],
    ["a feed page with a bad cursor", 200, { items: [], nextCursor: 5 }],
  ])("%s is CLIENT_BAD_RESPONSE", async (_label, status, body) => {
    const error = await rejection(createRecallFeedClient({ baseUrl: "/api", fetch: fakeFetch(status, body) }).listFeed());

    expect([error.code, error.status]).toEqual(["CLIENT_BAD_RESPONSE", status]);
  });

  it.each<[string, (client: ReturnType<typeof createRecallFeedClient>) => Promise<unknown>]>([
    ["getCard", (client) => client.getCard("c1")],
    ["importMarkdown", (client) => client.importMarkdown("# A\n\nB")],
    ["review", (client) => client.review("c1", "saved")],
  ])("%s refuses a success body that is not the expected object", async (_label, call) => {
    const error = await rejection(call(createRecallFeedClient({ baseUrl: "/api", fetch: fakeFetch(200, { unexpected: true }) })));

    expect(error.code).toBe("CLIENT_BAD_RESPONSE");
  });

  it("a network failure is CLIENT_NETWORK and does not pass on the underlying message", async () => {
    const failing: FetchFunction = async () => {
      throw new TypeError("connect failed to https://api.example.test with key k-123");
    };

    const error = await rejection(createRecallFeedClient({ baseUrl: "/api", apiKey: "k-123", fetch: failing }).listFeed());

    expect([error.code, error.status]).toEqual(["CLIENT_NETWORK", 0]);
    expect(error.message).not.toContain("k-123");
  });

  it("refuses an API key in a browser", () => {
    Object.assign(globalThis, { window: {}, document: {} });

    expect(() => createRecallFeedClient({ baseUrl: "/api", apiKey: "k-123" })).toThrow(RecallFeedApiError);
    expect(() => createRecallFeedClient({ baseUrl: "/api" })).not.toThrow();
  });

  it("uses the global fetch when none is given", async () => {
    const original = globalThis.fetch;
    const fetch = fakeFetch(200, { items: [], nextCursor: null });
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => fetch(String(input), init)) as typeof globalThis.fetch;
    try {
      await createRecallFeedClient({ baseUrl: "/api" }).listFeed();
    } finally {
      globalThis.fetch = original;
    }

    expect(fetch.sent.map((s) => s.url)).toEqual(["/api/feed"]);
  });
});
