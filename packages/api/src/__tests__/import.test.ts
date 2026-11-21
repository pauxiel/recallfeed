import { describe, expect, it } from "vitest";
import {
  APP_ORIGIN,
  DATABASE_TEST_TIMEOUT_MS,
  TEST_API_KEY,
  TEST_OWNER,
  accessContext,
  call,
  databaseUrl,
  json,
  markdownPost,
  privateEnv,
  publicEnv,
  testDb,
  uniqueName,
} from "./helpers";

const MAX = 100 * 1024;
const keyed = { "X-API-Key": TEST_API_KEY };

async function sourceCount(name: string): Promise<number> {
  const rows = await testDb().query("SELECT count(*)::int AS n FROM sources WHERE name = $1", [name]);
  return rows[0]?.n as number;
}

function jsonPost(body: unknown, headers: Record<string, string> = keyed): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

describe.skipIf(databaseUrl === "")("POST /import/markdown (real PostgreSQL through the proxy)", { timeout: DATABASE_TEST_TIMEOUT_MS }, () => {
  describe("public deployment, X-API-Key", () => {
    it("imports Markdown and returns exactly Spec 05's four fields", async () => {
      const name = uniqueName("pub");
      const response = await call("/import/markdown", jsonPost({ content: `# One\n\nbody ${name}\n\n# Two\n\nmore ${name}`, name }), publicEnv());

      expect(response.status).toBe(200);
      const body = await json(response);
      expect(Object.keys(body).sort()).toEqual(["feedItemsCreated", "notesImported", "queued", "sourceId"]);
      expect(body).toMatchObject({ queued: false, notesImported: 2, feedItemsCreated: 2 });
      expect(body.sourceId).toMatch(/^[0-9a-f-]{36}$/);
      const rows = await testDb().query(
        "SELECT (SELECT count(*)::int FROM notes WHERE source_id = $1) AS notes, (SELECT count(*)::int FROM feed_items WHERE source_id = $1) AS cards",
        [body.sourceId],
      );
      expect(rows[0]).toEqual({ notes: 2, cards: 2 });
    });

    it("accepts a raw text/markdown body, including a charset parameter", async () => {
      const name = uniqueName("raw");
      const response = await call(
        "/import/markdown",
        { method: "POST", headers: { "Content-Type": "text/markdown; charset=utf-8", ...keyed }, body: `# Raw\n\nbody of the raw import ${name}` },
        publicEnv(),
      );

      expect(response.status).toBe(200);
      expect(await json(response)).toMatchObject({ notesImported: 1, feedItemsCreated: 1 });
    });

    it("the same text twice: same source, second import creates no cards", async () => {
      const name = uniqueName("dup");
      const payload = jsonPost({ content: `# Dup\n\nbody ${name}`, name });
      const first = await json(await call("/import/markdown", payload, publicEnv()));
      const second = await json(await call("/import/markdown", payload, publicEnv()));

      expect(second.sourceId).toBe(first.sourceId);
      expect(second).toMatchObject({ notesImported: 1, feedItemsCreated: 0 });
      expect(await sourceCount(name)).toBe(1);
    });

    it("stores hostile content and names as data", async () => {
      const name = `${uniqueName("o'brien")}"; DROP TABLE notes; --`;
      const response = await call(
        "/import/markdown",
        jsonPost({ content: "# '); DROP TABLE feed_items; --\n\nbody with $1 and \"quotes\" and ✓", name }),
        publicEnv(),
      );

      expect(response.status).toBe(200);
      const tables = await testDb().query("SELECT to_regclass('public.notes') IS NOT NULL AS a, to_regclass('public.feed_items') IS NOT NULL AS b");
      expect(tables[0]).toEqual({ a: true, b: true });
    });

    it("an import of exactly 50 bytes works (the task's size example)", async () => {
      const text = `# T\n\n${"x".repeat(50 - 5)}`;
      expect(new TextEncoder().encode(text).length).toBe(50);

      expect((await call("/import/markdown", markdownBody(text, keyed), publicEnv())).status).toBe(200);
    });
  });

  describe("authorization: nothing is written for a refused request", () => {
    it("no API key: 401 AUTH_API_KEY_MISSING", async () => {
      const name = uniqueName("nokey");
      const response = await call("/import/markdown", jsonPost({ content: "# T\n\nbody of text", name }, {}), publicEnv());

      expect(response.status).toBe(401);
      expect(await json(response)).toEqual({ error: "X-API-Key header required", code: "AUTH_API_KEY_MISSING" });
      expect(await sourceCount(name)).toBe(0);
    });

    it("wrong API key: 403 AUTH_API_KEY_INVALID", async () => {
      const name = uniqueName("badkey");
      const response = await call("/import/markdown", jsonPost({ content: "# T\n\nbody of text", name }, { "X-API-Key": "wrong" }), publicEnv());

      expect(response.status).toBe(403);
      expect((await json(response)).code).toBe("AUTH_API_KEY_INVALID");
      expect(await sourceCount(name)).toBe(0);
    });

    it("authorization is checked before the body is read: an oversize unauthorized upload is 401, not 400", async () => {
      const response = await call(
        "/import/markdown",
        { method: "POST", headers: { "Content-Type": "text/markdown" }, body: "x".repeat(MAX * 3) },
        publicEnv(),
      );

      expect(response.status).toBe(401);
    });

    it("an owner identity does not authorize a write in a public deployment", async () => {
      const response = await call("/import/markdown", jsonPost({ content: "# T\n\nbody of text" }, {}), publicEnv({ OWNER_EMAIL: TEST_OWNER }), accessContext({ email: TEST_OWNER }));

      expect(response.status).toBe(401);
    });

    it("a public deployment with no API_SECRET_KEY configured refuses every write: 500 AUTH_NOT_CONFIGURED", async () => {
      const response = await call("/import/markdown", jsonPost({ content: "# T\n\nbody of text" }, { "X-API-Key": "" }), publicEnv({ API_SECRET_KEY: "" }));

      expect(response.status).toBe(500);
      expect((await json(response)).code).toBe("AUTH_NOT_CONFIGURED");
    });

    it("private deployment, no identity: 401 AUTH_REQUIRED", async () => {
      const name = uniqueName("anon");
      const response = await call("/import/markdown", markdownPost(`# T\n\nbody ${name}`), privateEnv(), accessContext(null));

      expect(response.status).toBe(401);
      expect((await json(response)).code).toBe("AUTH_REQUIRED");
    });

    it("private deployment, someone other than the owner: 403 AUTH_FORBIDDEN", async () => {
      const response = await call("/import/markdown", markdownPost("# T\n\nbody of text"), privateEnv(), accessContext({ email: "other@example.test" }));

      expect(response.status).toBe(403);
      expect((await json(response)).code).toBe("AUTH_FORBIDDEN");
    });

    it("private deployment: an X-API-Key is not accepted in place of the owner", async () => {
      const response = await call(
        "/import/markdown",
        markdownPost("# T\n\nbody of text", keyed),
        privateEnv({ API_SECRET_KEY: TEST_API_KEY }),
        accessContext(null),
      );

      expect(response.status).toBe(401);
    });

    it("private deployment with no FEED_VISIBILITY set is private, even with a valid key", async () => {
      const response = await call(
        "/import/markdown",
        // Same-origin, so the request gets past CSRF and the visibility default is what is tested.
        jsonPost({ content: "# T\n\nbody of text" }, { ...keyed, Origin: APP_ORIGIN }),
        { DATABASE_URL: databaseUrl, API_SECRET_KEY: TEST_API_KEY, OWNER_EMAIL: TEST_OWNER },
        accessContext(null),
      );

      expect(response.status).toBe(401);
    });
  });

  describe("private deployment: the owner, CSRF, and cache headers", () => {
    it("the owner's same-origin import succeeds and the response is private, no-store", async () => {
      const name = uniqueName("owner");
      // JSON body so the test can name its own source and not share the default one across runs.
      const response = await call(
        "/import/markdown",
        jsonPost({ content: `# Owner\n\nbody of the owner's note ${name}`, name }, { Origin: APP_ORIGIN }),
        privateEnv(),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await json(response)).toMatchObject({ queued: false, notesImported: 1, feedItemsCreated: 1 });
    });

    it("a cross-origin import is 403 CSRF_ORIGIN_MISMATCH even for the owner, and writes nothing", async () => {
      const name = uniqueName("csrf");
      const response = await call(
        "/import/markdown",
        { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: JSON.stringify({ content: "# T\n\nbody of text", name }) },
        privateEnv(),
      );

      expect(response.status).toBe(403);
      expect((await json(response)).code).toBe("CSRF_ORIGIN_MISMATCH");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await sourceCount(name)).toBe(0);
    });

    it("a mutation with no Origin or Referer is 403 CSRF_ORIGIN_MISSING", async () => {
      const response = await call(
        "/import/markdown",
        { method: "POST", headers: { "Content-Type": "text/markdown" }, body: "# T\n\nbody of text" },
        privateEnv(),
      );

      expect(response.status).toBe(403);
      expect((await json(response)).code).toBe("CSRF_ORIGIN_MISSING");
    });

    it("every refusal in private mode, 401 and 403 alike, is private, no-store", async () => {
      const anon = await call("/import/markdown", markdownPost("# T\n\nbody of text"), privateEnv(), accessContext(null));
      const stranger = await call("/import/markdown", markdownPost("# T\n\nbody of text"), privateEnv(), accessContext({ email: "x@y.test" }));
      const bad = await call("/import/markdown", markdownPost("short"), privateEnv());

      expect([anon.status, stranger.status, bad.status]).toEqual([401, 403, 400]);
      for (const response of [anon, stranger, bad]) {
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      }
    });
  });

  describe("validation (400, nothing written)", () => {
    const post = (body: string | Uint8Array, headers: Record<string, string> = {}) =>
      call("/import/markdown", { method: "POST", headers: { "Content-Type": "text/markdown", ...keyed, ...headers }, body }, publicEnv());

    it("9 bytes is too small and 10 bytes is accepted", async () => {
      const small = await post("012345678");
      expect(small.status).toBe(400);
      expect((await json(small)).code).toBe("VALIDATION_SIZE");

      expect((await post("0123456789")).status).toBe(200);
    });

    it("exactly 100 KB is accepted and 100 KB plus one byte is 400 (101 KB too)", async () => {
      expect((await post(`# T\n\n${"x".repeat(MAX - 5)}`)).status).toBe(200);

      const over = await post("x".repeat(MAX + 1));
      expect(over.status).toBe(400);
      expect((await json(over)).code).toBe("VALIDATION_SIZE");

      expect((await post("x".repeat(101 * 1024))).status).toBe(400);
    });

    it("a huge declared Content-Length is refused without reading the body", async () => {
      const response = await post("tiny but declared huge", { "Content-Length": String(50 * 1024 * 1024) });

      expect(response.status).toBe(400);
      expect((await json(response)).code).toBe("VALIDATION_SIZE");
    });

    it("stops reading a body of unknown length shortly after the cap (markdown and JSON)", async () => {
      // No Content-Length, so only the read loop can stop it. Chunks are pulled on demand, so the
      // count of bytes pulled shows how far the Worker read before refusing.
      const CHUNK = 16 * 1024;
      const streamOf = (totalChunks: number, pulled: { bytes: number }): ReadableStream<Uint8Array> => {
        let sent = 0;
        return new ReadableStream<Uint8Array>(
          {
            pull(controller): void {
              if (sent >= totalChunks) {
                controller.close();
                return;
              }
              sent += 1;
              pulled.bytes += CHUNK;
              controller.enqueue(new Uint8Array(CHUNK).fill(120));
            },
          },
          { highWaterMark: 0 },
        );
      };
      const send = (contentType: string, pulled: { bytes: number }): Promise<Response> =>
        call(
          "/import/markdown",
          { method: "POST", headers: { "Content-Type": contentType, ...keyed }, body: streamOf(400, pulled), duplex: "half" } as RequestInit,
          publicEnv(),
        );

      const markdown = { bytes: 0 };
      const markdownResponse = await send("text/markdown", markdown);
      expect(markdownResponse.status).toBe(400);
      expect((await json(markdownResponse)).code).toBe("VALIDATION_SIZE");
      expect(markdown.bytes).toBeLessThanOrEqual(MAX + 1 + 2 * CHUNK);

      const asJson = { bytes: 0 };
      const jsonResponse = await send("application/json", asJson);
      expect(jsonResponse.status).toBe(400);
      expect((await json(jsonResponse)).code).toBe("VALIDATION_SIZE");
      expect(asJson.bytes).toBeLessThanOrEqual(6 * MAX + 4096 + 2 * CHUNK);
      expect(asJson.bytes).toBeLessThan(400 * CHUNK); // 6.4 MB offered; far less was read
    });

    it("a JSON body far beyond the cap is refused", async () => {
      const response = await call("/import/markdown", jsonPost({ content: "x".repeat(MAX * 7) }), publicEnv());

      expect(response.status).toBe(400);
      expect((await json(response)).code).toBe("VALIDATION_SIZE");
    });

    it("measures UTF-8 bytes: 60,000 two-byte characters in a JSON body exceed the limit", async () => {
      const response = await call("/import/markdown", jsonPost({ content: "é".repeat(60_000) }), publicEnv());

      expect(response.status).toBe(400);
      expect((await json(response)).code).toBe("VALIDATION_SIZE");
    });

    it.each([
      ["no Content-Type", {}],
      ["text/plain", { "Content-Type": "text/plain" }],
      ["application/x-www-form-urlencoded", { "Content-Type": "application/x-www-form-urlencoded" }],
      ["multipart/form-data", { "Content-Type": "multipart/form-data; boundary=x" }],
    ])("an unsupported Content-Type (%s) is 400 VALIDATION_CONTENT_TYPE", async (_label, headers) => {
      const response = await call("/import/markdown", { method: "POST", headers: { ...keyed, ...headers }, body: "# T\n\nbody of text" }, publicEnv());

      expect(response.status).toBe(400);
      expect((await json(response)).code).toBe("VALIDATION_CONTENT_TYPE");
    });

    it.each([
      ["invalid JSON", "{not json"],
      ["a JSON array", "[]"],
      ["a JSON string", '"just a string with enough bytes"'],
      ["null", "null"],
      ["an object without content", '{"name":"x"}'],
      ["a non-string content", '{"content":12345678901234}'],
      ["a non-string name", '{"content":"# T\\n\\nbody of text","name":42}'],
    ])("%s is 400 VALIDATION_JSON or VALIDATION_NAME", async (_label, body) => {
      const response = await call("/import/markdown", jsonPost(body), publicEnv());

      expect(response.status).toBe(400);
      expect(["VALIDATION_JSON", "VALIDATION_NAME"]).toContain((await json(response)).code);
    });

    it("bytes that are not valid UTF-8 are 400 VALIDATION_ENCODING", async () => {
      const response = await post(new Uint8Array([0x23, 0x20, 0xff, 0xfe, 0xfd, 0x20, 0x68, 0x65, 0x6c, 0x6c, 0x6f]));

      expect(response.status).toBe(400);
      expect((await json(response)).code).toBe("VALIDATION_ENCODING");
    });

    it("a NUL character and a lone surrogate are 400 VALIDATION_CONTENT, not a database error", async () => {
      const nul = await call("/import/markdown", jsonPost({ content: "# T\n\nbody with a \u0000 nul" }), publicEnv());
      const lone = await call("/import/markdown", jsonPost('{"content":"# T\\n\\nbody with a \\ud83d lone surrogate"}'), publicEnv());

      expect(nul.status).toBe(400);
      expect((await json(nul)).code).toBe("VALIDATION_CONTENT");
      expect(lone.status).toBe(400);
      expect((await json(lone)).code).toBe("VALIDATION_CONTENT");
    });

    it("a name that is too long or contains control characters is 400 VALIDATION_NAME", async () => {
      const long = await call("/import/markdown", jsonPost({ content: "# T\n\nbody of text", name: "n".repeat(201) }), publicEnv());
      const control = await call("/import/markdown", jsonPost({ content: "# T\n\nbody of text", name: "bad\nname" }), publicEnv());

      expect((await json(long)).code).toBe("VALIDATION_NAME");
      expect((await json(control)).code).toBe("VALIDATION_NAME");
    });

    it("an empty body is 400, not a crash", async () => {
      expect((await post("")).status).toBe(400);
    });

    it("every error response is {error, code} and nothing else", async () => {
      const response = await post("short");

      expect(Object.keys(await json(response)).sort()).toEqual(["code", "error"]);
    });
  });

  it("only POST is routed: other methods on /import/markdown are 404 with the standard error body", async () => {
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const response = await call("/import/markdown", { method, headers: keyed }, publicEnv());

      expect(response.status).toBe(404);
      expect((await json(response)).code).toBe("NOT_FOUND_ROUTE");
    }
  });

  describe("DEFAULT_CARD_TYPES: which cards an import creates", () => {
    async function cardTypes(sourceId: string): Promise<string[]> {
      const rows = await testDb().query(
        "SELECT f.card_type FROM feed_items f JOIN notes n ON n.id = f.note_id WHERE f.source_id = $1 ORDER BY n.title, f.card_type DESC",
        [sourceId],
      );
      return rows.map((row) => String(row.card_type));
    }
    const text = (name: string) => `# A ${name}\n\n> a quoted line ${name}\n\n# B ${name}\n\nNothing to highlight.`;

    it("unset creates original cards only, as before", async () => {
      const name = uniqueName("ct-unset");
      const body = await json(await call("/import/markdown", jsonPost({ content: text(name), name }), publicEnv()));

      expect(body.feedItemsCreated).toBe(2);
      expect(await cardTypes(String(body.sourceId))).toEqual(["original", "original"]);
    });

    it("a list with highlight creates highlight cards in the same import; types without a generator are skipped", async () => {
      const name = uniqueName("ct-hl");
      const env = publicEnv({ DEFAULT_CARD_TYPES: "original,highlight,reflection_prompt" });
      const body = await json(await call("/import/markdown", jsonPost({ content: text(name), name }), env));

      expect(body.feedItemsCreated).toBe(3);
      expect(await cardTypes(String(body.sourceId))).toEqual(["original", "highlight", "original"]);
    });

    it("works the same in a private deployment for the owner", async () => {
      const name = uniqueName("ct-priv");
      const env = privateEnv({ DEFAULT_CARD_TYPES: "original,highlight" });
      const response = await call(
        "/import/markdown",
        jsonPost({ content: text(name), name }, { Origin: APP_ORIGIN }),
        env,
        accessContext({ email: TEST_OWNER }),
      );

      expect(response.status).toBe(200);
      expect((await json(response)).feedItemsCreated).toBe(3);
    });

    it("an unknown card type is a generic 500 INTERNAL_CONFIG, the value is not echoed, and nothing is written", async () => {
      const name = uniqueName("ct-bad");
      const response = await call("/import/markdown", jsonPost({ content: text(name), name }), publicEnv({ DEFAULT_CARD_TYPES: "original,quotez" }));
      const raw = await response.text();

      expect(response.status).toBe(500);
      expect(JSON.parse(raw)).toEqual({ error: "Internal server error", code: "INTERNAL_ERROR" });
      expect(raw).not.toContain("quotez");
      expect(await sourceCount(name)).toBe(0);
    });

    it("a refused caller gets the authorization error, not the configuration error", async () => {
      const name = uniqueName("ct-auth");
      const response = await call("/import/markdown", jsonPost({ content: text(name), name }, {}), publicEnv({ DEFAULT_CARD_TYPES: "quotez" }));

      expect(response.status).toBe(401);
      expect((await json(response)).code).toBe("AUTH_API_KEY_MISSING");
    });
  });
});

/** A raw Markdown POST with the given extra headers. */
function markdownBody(text: string, headers: Record<string, string>): RequestInit {
  return { method: "POST", headers: { "Content-Type": "text/markdown", ...headers }, body: text };
}

