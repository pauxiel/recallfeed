import type { Note } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { extractHighlight, generateHighlightCard } from "../generators/highlight";

const note = (content: string): Note => ({
  id: "33333333-3333-4333-8333-333333333333",
  sourceId: "44444444-4444-4444-8444-444444444444",
  title: "A note",
  content,
  contentHash: "x".repeat(64),
  metadata: {},
  importedAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
});

describe("extractHighlight: blockquotes", () => {
  it("a note with `> quote` gives a highlight of the quote (Task 28)", () => {
    expect(extractHighlight("Intro.\n\n> Simplicity is prerequisite for reliability.\n\nOutro.")).toBe(
      "Simplicity is prerequisite for reliability.",
    );
  });

  it("keeps a multi-line quote, including its blank lines, without the markers", () => {
    expect(extractHighlight("> first line\n> second line\n>\n> after a gap")).toBe("first line\nsecond line\n\nafter a gap");
  });

  it("takes only the first quote when there are several", () => {
    expect(extractHighlight("> one\n\ntext\n\n> two")).toBe("one");
  });

  it("strips nested quote markers too", () => {
    expect(extractHighlight("> > deeply quoted\n> outer")).toBe("deeply quoted\nouter");
  });

  it("accepts a quote marker with no space and with up to three leading spaces", () => {
    expect(extractHighlight(">tight")).toBe("tight");
    expect(extractHighlight("   > indented")).toBe("indented");
  });

  it("prefers a quote over emphasis", () => {
    expect(extractHighlight("**bold first**\n\n> the quote")).toBe("the quote");
  });

  it("an empty quote is not a highlight, and emphasis is used instead", () => {
    expect(extractHighlight(">\n>\n\n**fallback**")).toBe("fallback");
  });
});

describe("extractHighlight: emphasis", () => {
  it("collects strong and emphasized spans in document order, one per line", () => {
    expect(extractHighlight("Try **this**, then *that*, then __another__ and _one more_.")).toBe(
      "this\nthat\nanother\none more",
    );
  });

  it("does not repeat a span that appears twice", () => {
    expect(extractHighlight("**key** and later **key** again")).toBe("key");
  });

  it("reads spans across lines and paragraphs", () => {
    expect(extractHighlight("first *alpha*\n\nthen **beta**")).toBe("alpha\nbeta");
  });

  it("does not treat a list bullet, arithmetic, or a lone star as emphasis", () => {
    expect(extractHighlight("- item one\n- item two\n\n2 * 3 * 4 = 24\n\na * b")).toBeNull();
  });

  it("does not treat underscores inside words as emphasis", () => {
    expect(extractHighlight("call snake_case_name and my_var_two helpers")).toBeNull();
  });

  it("does not treat delimiters with spaces inside as emphasis", () => {
    expect(extractHighlight("this is ** not bold ** and * not em *")).toBeNull();
  });
});

describe("extractHighlight: code is never a highlight", () => {
  it("ignores a quote and emphasis inside a fenced code block", () => {
    expect(extractHighlight("```\n> not a quote\n**not bold**\n```\n\nplain text")).toBeNull();
  });

  it("finds a real quote after a code block", () => {
    expect(extractHighlight("```js\nconst x = a ** b;\n```\n\n> real quote")).toBe("real quote");
  });

  it("handles tilde fences and longer fences that contain shorter ones", () => {
    expect(extractHighlight("~~~\n> inside\n~~~\n> outside")).toBe("outside");
    expect(extractHighlight("````\n```\n> inside\n```\n````\n> outside")).toBe("outside");
  });

  it("a backtick fence is not closed by a tilde line, or a tilde fence by backticks", () => {
    expect(extractHighlight("```\n~~~\n> inside\n```\n> outside")).toBe("outside");
    expect(extractHighlight("~~~\n```\n> inside\n~~~\n> outside")).toBe("outside");
  });

  it("a fence that is never closed hides everything after it", () => {
    expect(extractHighlight("```\n> never closed\n**still code**")).toBeNull();
  });

  it("ignores emphasis inside inline code", () => {
    expect(extractHighlight("run `a **b** c` then *real*")).toBe("real");
  });
});

describe("extractHighlight: inline code inside emphasis keeps its text", () => {
  it("keeps the code in the middle of a bold span (the reported bug)", () => {
    expect(extractHighlight("**Change `wrangler.toml`, replace `public/`, and add your own notes.**")).toBe(
      "Change `wrangler.toml`, replace `public/`, and add your own notes.",
    );
  });

  it("keeps the code when the span starts with it, and still finds the span", () => {
    expect(extractHighlight("**`pnpm seed` loads the sample notes.** It is safe to repeat.")).toBe("`pnpm seed` loads the sample notes.");
  });

  it("keeps the code when the span ends with it, or is only code", () => {
    expect(extractHighlight("**Run `pnpm dev`**")).toBe("Run `pnpm dev`");
    expect(extractHighlight("**`x`**")).toBe("`x`");
  });

  it("works for every emphasis form", () => {
    expect(extractHighlight("__use `kind` here__")).toBe("use `kind` here");
    expect(extractHighlight("*use `kind` here*")).toBe("use `kind` here");
    expect(extractHighlight("_use `kind` here_")).toBe("use `kind` here");
  });

  it("keeps emphasis delimiters that sit inside the code, and is not confused by them", () => {
    expect(extractHighlight("**use `a*b` and `**` carefully**")).toBe("use `a*b` and `**` carefully");
    expect(extractHighlight("*see `a_b_c` now*")).toBe("see `a_b_c` now");
  });

  it("keeps the code text across several spans, in document order, without repeats", () => {
    expect(extractHighlight("**Run `a`.** Then **run `b`.** Then **Run `a`.**")).toBe("Run `a`.\nrun `b`.");
  });

  it("keeps the original spacing of the text around the code", () => {
    expect(extractHighlight("**a  `b`  c**")).toBe("a  `b`  c");
  });

  it("underscore emphasis directly next to inline code still counts, as it does next to any punctuation", () => {
    expect(extractHighlight("see `a`_real_ and _real2_`b` too")).toBe("real\nreal2");
  });

  it("trims whitespace other than a space around a span's text", () => {
    expect(extractHighlight("**\ttabbed `x`\t**")).toBe("tabbed `x`");
  });

  it("still never treats code as emphasis: emphasis marks only inside code give no highlight", () => {
    expect(extractHighlight("run `**not bold**` and `*not em*` here")).toBeNull();
  });

  it("generateHighlightCard carries the code text into the card", () => {
    const card = generateHighlightCard(note("## Title\n\n**Change `wrangler.toml` and `public/`.**"));

    expect(card?.content).toBe("Change `wrangler.toml` and `public/`.");
    expect(card?.cardType).toBe("highlight");
  });
});

describe("extractHighlight: nothing to highlight", () => {
  it.each(["", "   ", "Just a plain sentence.", "# Heading only", "| a | b |\n|---|---|\n| 1 | 2 |"])(
    "returns null for %j",
    (content) => {
      expect(extractHighlight(content)).toBeNull();
    },
  );

  it("normalizes Windows line endings", () => {
    expect(extractHighlight("intro\r\n\r\n> quoted\r\n> more")).toBe("quoted\nmore");
  });

  it("is deterministic", () => {
    const content = "**a** *b* > not a quote mid-line\n\n> quote";
    expect(extractHighlight(content)).toBe(extractHighlight(content));
  });

  it("stays fast on long hostile input (no catastrophic backtracking)", () => {
    const hostile = `${"*a".repeat(20000)}\n${"_".repeat(20000)}\n${"**".repeat(20000)}`;
    const start = performance.now();
    extractHighlight(hostile);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("generateHighlightCard", () => {
  it("builds a highlight card for a note with a quote, never AI-generated", () => {
    expect(generateHighlightCard(note("> keep this"))).toEqual({
      noteId: "33333333-3333-4333-8333-333333333333",
      sourceId: "44444444-4444-4444-8444-444444444444",
      cardType: "highlight",
      content: "keep this",
      isAiGenerated: false,
    });
  });

  it("returns null for a note with nothing to highlight, so no card is created", () => {
    expect(generateHighlightCard(note("Nothing special here."))).toBeNull();
  });
});
