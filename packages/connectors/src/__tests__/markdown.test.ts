import { ConnectorError } from "@recallfeed/core";
import type { Source } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { MARKDOWN_MAX_BYTES, MarkdownConnector } from "../markdown";
import { sha256Hex } from "../hash";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const source: Source = {
  id: SOURCE_ID,
  name: "test",
  type: "markdown",
  config: {},
  isActive: true,
  lastSyncedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const connector = new MarkdownConnector();
const run = (content: string | undefined) => connector.import(source, { content });

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ConnectorError ? error.code : `unexpected: ${String(error)}`;
  }
  return undefined;
}

describe("sha256Hex", () => {
  it("matches the standard SHA-256 test vectors", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("MarkdownConnector: sections", () => {
  it("splits on level 1 and 2 headings, one note per section with a body", async () => {
    const notes = await run("# Note 1\n\nContent\n\n---\n\n# Note 2\n\nMore content");

    expect(notes.map((note) => [note.title, note.content])).toEqual([
      ["Note 1", "Content"],
      ["Note 2", "More content"],
    ]);
    expect(notes.every((note) => note.sourceId === SOURCE_ID)).toBe(true);
  });

  it("the todo's literal example yields ONE note under Spec 03, because '# Note 2' has no body", async () => {
    // Task 15 lists "# Note 1\n\nContent\n\n---\n\n# Note 2" as producing two notes. Spec 03 drops a
    // section with no body (`parts.length > 0`), so only the first survives. The spec governs.
    const notes = await run("# Note 1\n\nContent\n\n---\n\n# Note 2");

    expect(notes.map((note) => note.title)).toEqual(["Note 1"]);
  });

  it("keeps level 3 and deeper headings inside their section", async () => {
    const notes = await run("# Top\n\nIntro\n\n### Detail\n\nMore");

    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toBe("Intro\n\n### Detail\n\nMore");
  });

  it("a heading-free document becomes one note holding all content", async () => {
    const notes = await run("Just a paragraph.\n\nAnd another one.");

    expect(notes).toHaveLength(1);
    expect(notes[0]?.title).toBeNull();
    expect(notes[0]?.content).toBe("Just a paragraph.\n\nAnd another one.");
  });

  it("keeps leading quotes, code, and lists that come before the first heading", async () => {
    const notes = await run("> a leading quote\n\n```sh\nls -la\n```\n\n- first\n- second\n\n# Then a heading\n\nBody");

    expect(notes).toHaveLength(2);
    expect(notes[0]?.title).toBeNull();
    expect(notes[0]?.content).toBe("> a leading quote\n\n```sh\nls -la\n```\n\n- first\n- second");
    expect(notes[0]?.metadata).toMatchObject({ hasBlockquote: true, hasCodeBlock: true, codeLanguage: "sh" });
    expect(notes[1]?.title).toBe("Then a heading");
  });

  it("a level 3 heading before any section is kept, not dropped", async () => {
    const notes = await run("### Early detail\n\nbody text");

    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toBe("### Early detail\n\nbody text");
  });

  it("a heading inside a fenced code block is code, not a section break", async () => {
    const notes = await run("# Real\n\nIntro\n\n```md\n# not a heading\n## nor this\n```\n\nOutro");

    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toContain("# not a heading");
    expect(notes[0]?.content).toContain("## nor this");
    expect(notes[0]?.metadata).toMatchObject({ hasCodeBlock: true, codeLanguage: "md" });
  });

  it("uses a longer fence when the code itself contains a fence", async () => {
    const notes = await run("# T\n\n````md\n```js\nx\n```\n````\n");

    expect(notes[0]?.content).toBe("````md\n```js\nx\n```\n````");
  });

  it("renders lists, keeping ordering and nesting", async () => {
    const notes = await run("# L\n\n1. one\n2. two\n\n- a\n- b\n  - nested");

    expect(notes[0]?.content).toBe("1. one\n2. two\n\n- a\n- b\n  - nested");
  });

  it("prefixes every line of a multi-line quote", async () => {
    const notes = await run("# Q\n\n> line one\n> line two");

    expect(notes[0]?.content).toBe("> line one\n> line two");
    expect(notes[0]?.metadata).toMatchObject({ hasBlockquote: true });
  });

  it("keeps a table as Markdown instead of silently dropping it", async () => {
    const notes = await run("# T\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");

    expect(notes[0]?.content).toContain("| a | b |");
    expect(notes[0]?.content).toContain("| 1 | 2 |");
  });

  it("records the heading level and no stray keys", async () => {
    const notes = await run("## Two\n\nbody");

    expect(notes[0]?.metadata).toEqual({ tags: [], headingLevel: 2 });
  });
});

describe("MarkdownConnector: frontmatter", () => {
  const doc =
    '---\ntitle: "Doc Title"\ntags: ["one", "two"]\nauthor: Ada\ndate: 2026-11-07\n---\n\n# Heading\n\nBody text';

  it("reads title, tags, author, and date; a heading title wins over the frontmatter title", async () => {
    const notes = await run(doc);

    expect(notes).toHaveLength(1);
    expect(notes[0]?.title).toBe("Heading");
    expect(notes[0]?.content).toBe("Body text");
    expect(notes[0]?.metadata).toEqual({
      tags: ["one", "two"],
      author: "Ada",
      sourceCreatedAt: "2026-11-07T00:00:00.000Z",
      headingLevel: 1,
    });
  });

  it("uses the frontmatter title when a card has no heading", async () => {
    const notes = await run('---\ntitle: From Frontmatter\n---\nPlain body only.');

    expect(notes[0]?.title).toBe("From Frontmatter");
  });

  it("frontmatter fields are not part of the note content", async () => {
    const notes = await run(doc);

    expect(notes[0]?.content).not.toContain("author");
    expect(notes[0]?.content).not.toContain("---");
  });

  it("frontmatter with no recognized field is body text, not swallowed", async () => {
    const notes = await run("---\nunknown: value\n---\n\n# Heading\n\nBody");

    expect(notes.map((note) => note.title)).toContain("Heading");
    const all = notes.map((note) => note.content).join("\n");
    expect(all).toContain("Body");
  });

  it("an unclosed or malformed frontmatter block is treated as body, never an error", async () => {
    await expect(run("---\ntitle: never closed\n\n# Heading\n\nBody")).resolves.toBeInstanceOf(Array);
    const notes = await run("---\ntitle: never closed\n\n# Heading\n\nBody");
    expect(notes.length).toBeGreaterThan(0);
  });

  it("ignores an unparseable date instead of inventing one", async () => {
    const notes = await run("---\ntitle: T\ndate: not a date\n---\nbody");

    expect(notes[0]?.metadata).toEqual({ tags: [] });
  });
});

describe("MarkdownConnector: determinism and hashing", () => {
  it("is idempotent: importing the same text twice gives identical notes", async () => {
    const text = "---\ntitle: T\ntags: [a]\n---\n# One\n\nbody one\n\n# Two\n\nbody two";

    expect(await run(text)).toEqual(await run(text));
  });

  it("contentHash is the SHA-256 of the note content", async () => {
    const [note] = await run("# H\n\nhello world");

    expect(note?.contentHash).toBe(await sha256Hex("hello world"));
    expect(note?.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different content gives a different hash, equal content an equal hash", async () => {
    const [a] = await run("# A\n\nsame body");
    const [b] = await run("# B\n\nsame body");
    const [c] = await run("# A\n\nother body");

    expect(a?.contentHash).toBe(b?.contentHash);
    expect(a?.contentHash).not.toBe(c?.contentHash);
  });

  it("CRLF and LF line endings give the same notes", async () => {
    const lf = "# T\n\nline one\n\nline two";
    const crlf = lf.replace(/\n/g, "\r\n");

    expect(await run(crlf)).toEqual(await run(lf));
  });

  it("no wall-clock value leaks into the output", async () => {
    const [note] = await run("# T\n\nbody");

    expect(JSON.stringify(note)).not.toMatch(/20\d\d-\d\d-\d\dT/);
  });
});

describe("MarkdownConnector: input limits and errors", () => {
  it.each([undefined, ""])("throws MARKDOWN_NO_CONTENT for %j", async (content) => {
    expect(await codeOf(run(content))).toBe("MARKDOWN_NO_CONTENT");
  });

  it("accepts exactly the maximum size and rejects one byte more", async () => {
    const atLimit = "a".repeat(MARKDOWN_MAX_BYTES);

    await expect(run(atLimit)).resolves.toHaveLength(1);
    expect(await codeOf(run(atLimit + "a"))).toBe("MARKDOWN_TOO_LARGE");
  });

  it("measures bytes, not characters: 60,000 two-byte characters exceed the limit", async () => {
    const text = "é".repeat(60_000);

    expect(text.length).toBeLessThan(MARKDOWN_MAX_BYTES);
    expect(await codeOf(run(text))).toBe("MARKDOWN_TOO_LARGE");
  });

  it("returns no notes for text with nothing extractable, and does not throw", async () => {
    expect(await run("---\n\n---\n\n---")).toEqual([]);
    expect(await run("   \n\n   ")).toEqual([]);
  });

  it.each([
    ["unclosed fence", "# T\n\n```js\nnever closed"],
    ["a lone bracket", "# T\n\n[unclosed link(\n\n![img"],
    ["control characters", "# T\n\nbody \u0001\u0002 tail"],
    ["deeply nested lists", "# T\n\n" + Array.from({ length: 40 }, (_, i) => `${"  ".repeat(i)}- item ${i}`).join("\n")],
    ["html", "# T\n\n<script>alert(1)</script>\n\n<div>x</div>"],
    ["only whitespace around a heading", "\n\n#   \n\n"],
    ["unicode and emoji", "# 漢字 🌍\n\nÉcole — naïve café ✓"],
  ])("odd Markdown is never an error: %s", async (_label, text) => {
    await expect(run(text)).resolves.toBeInstanceOf(Array);
  });

  it.each([
    ["2,000 nested blockquote markers (4 KB)", "> ".repeat(2000)],
    ["10,000 nested list markers on one line (20 KB)", "- ".repeat(10_000) + "x"],
    ["5,000 nested ordered markers", "1. ".repeat(5_000) + "x"],
    ["100,000 greater-than signs (100 KB)", ">".repeat(100_000)],
  ])("regression: input that overflows the lexer's call stack degrades to a text note, never an error: %s", async (_label, text) => {
    // Measured: marked's lexer throws RangeError on these (a few KB is enough). The connector must
    // not let that escape from a public endpoint, and must not lose the content.
    const notes = await run(`${text}`.slice(0, MARKDOWN_MAX_BYTES));

    expect(notes).toHaveLength(1);
    expect(notes[0]?.content.length).toBeGreaterThan(0);
    expect(notes[0]?.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the stack-overflow fallback keeps the text and is deterministic", async () => {
    const text = "> ".repeat(3000);

    const first = await run(text);
    const second = await run(text);

    expect(first).toEqual(second);
    expect(first[0]?.content).toContain(">");
  });

  it("does not execute or pass through HTML as an instruction: it is data, dropped from cards", async () => {
    const notes = await run("# T\n\nsafe text\n\n<script>alert(1)</script>");

    expect(notes[0]?.content).toBe("safe text");
  });
});

describe("MarkdownConnector: pathological input stays fast (public endpoint)", () => {
  // These are safety checks against catastrophic parser backtracking, not benchmarks. The ceiling is
  // deliberately generous so it never flakes; a real regression would take tens of seconds or hang.
  const CEILING_MS = 8_000;

  it.each([
    ["100,000 asterisks", "*".repeat(100_000)],
    ["50,000 open brackets", "[".repeat(50_000)],
    ["50,000 backticks", "`".repeat(50_000)],
    ["repeated quote markers", "> ".repeat(40_000)],
    ["very long single line", "word ".repeat(20_000)],
    ["many empty list items", "-\n".repeat(50_000)],
    ["nested emphasis", "*a **b ".repeat(10_000)],
  ])("%s", async (_label, text) => {
    const body = text.slice(0, MARKDOWN_MAX_BYTES);
    const startedAt = Date.now();

    await expect(run(`# T\n\n${body}`.slice(0, MARKDOWN_MAX_BYTES))).resolves.toBeInstanceOf(Array);

    expect(Date.now() - startedAt).toBeLessThan(CEILING_MS);
  });
});
