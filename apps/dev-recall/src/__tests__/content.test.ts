import { describe, expect, it } from "vitest";
import { splitBlocks, splitInline } from "../content";

describe("splitBlocks", () => {
  it("splits paragraphs on blank lines and keeps a paragraph's own line breaks", () => {
    expect(splitBlocks("First line\nsecond line\n\nNext paragraph")).toEqual([
      { kind: "text", text: "First line\nsecond line" },
      { kind: "text", text: "Next paragraph" },
    ]);
  });

  it("extracts a fenced code block with its language, between paragraphs", () => {
    const content = "Before\n\n```ts\nconst x = 1;\n\nconst y = 2;\n```\n\nAfter";

    expect(splitBlocks(content)).toEqual([
      { kind: "text", text: "Before" },
      { kind: "code", language: "ts", code: "const x = 1;\n\nconst y = 2;" },
      { kind: "text", text: "After" },
    ]);
  });

  it("a fence directly after text still starts a code block", () => {
    expect(splitBlocks("Intro\n```sql\nSELECT 1;\n```")).toEqual([
      { kind: "text", text: "Intro" },
      { kind: "code", language: "sql", code: "SELECT 1;" },
    ]);
  });

  it("handles tilde fences, a missing language, and indentation of up to three spaces", () => {
    expect(splitBlocks("~~~\nplain\n~~~")).toEqual([{ kind: "code", language: "", code: "plain" }]);
    expect(splitBlocks("   ```rust\nfn main() {}\n   ```")).toEqual([{ kind: "code", language: "rust", code: "fn main() {}" }]);
  });

  it("a line indented four or more spaces is not a fence", () => {
    expect(splitBlocks("    ```js\nnot code\n    ```")).toEqual([{ kind: "text", text: "```js\nnot code\n    ```" }]);
  });

  it("a longer fence is closed only by an equal or longer one, so a shorter fence inside stays code", () => {
    const content = "````md\n```ts\ninner\n```\n````";

    expect(splitBlocks(content)).toEqual([{ kind: "code", language: "md", code: "```ts\ninner\n```" }]);
  });

  it("a backtick fence is not closed by a tilde fence", () => {
    expect(splitBlocks("```\ncode\n~~~\nstill code")).toEqual([{ kind: "code", language: "", code: "code\n~~~\nstill code" }]);
  });

  it("an unclosed fence runs to the end", () => {
    expect(splitBlocks("Text\n\n```js\nlet a = 1;")).toEqual([
      { kind: "text", text: "Text" },
      { kind: "code", language: "js", code: "let a = 1;" },
    ]);
  });

  it("drops empty blocks and normalizes Windows line endings", () => {
    expect(splitBlocks("\n\n```\n\n```\n\n")).toEqual([]);
    expect(splitBlocks("a\r\nb\r\n\r\nc")).toEqual([
      { kind: "text", text: "a\nb" },
      { kind: "text", text: "c" },
    ]);
  });

  it("returns nothing for empty content", () => {
    expect(splitBlocks("")).toEqual([]);
  });

  it("keeps markup as plain text, never interpreting it", () => {
    const hostile = '<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>';

    expect(splitBlocks(hostile)).toEqual([
      { kind: "text", text: '<script>alert("x")</script>' },
      { kind: "text", text: "<img src=x onerror=alert(1)>" },
    ]);
  });
});

describe("splitInline", () => {
  it("splits bold and inline code from plain text, in order", () => {
    expect(splitInline("Use **idempotency keys** with `POST /pay` always.")).toEqual([
      { kind: "text", text: "Use " },
      { kind: "bold", runs: [{ kind: "text", text: "idempotency keys" }] },
      { kind: "text", text: " with " },
      { kind: "code", text: "POST /pay" },
      { kind: "text", text: " always." },
    ]);
  });

  it("a lone marker stays as text", () => {
    expect(splitInline("2 ** 3 and a ` tick")).toEqual([{ kind: "text", text: "2 ** 3 and a ` tick" }]);
  });

  it("bold does not span a line break", () => {
    expect(splitInline("**not\nbold**")).toEqual([{ kind: "text", text: "**not\nbold**" }]);
  });

  it("starts and ends with a marked run", () => {
    expect(splitInline("**A**`b`")).toEqual([
      { kind: "bold", runs: [{ kind: "text", text: "A" }] },
      { kind: "code", text: "b" },
    ]);
  });

  it("keeps markup inside runs as plain text", () => {
    expect(splitInline("**<b>x</b>** and `<i>`")).toEqual([
      { kind: "bold", runs: [{ kind: "text", text: "<b>x</b>" }] },
      { kind: "text", text: " and " },
      { kind: "code", text: "<i>" },
    ]);
  });

  it("bold may contain inline code, which is read as code and not shown with its backticks", () => {
    expect(splitInline("**Give each variant a literal `kind`, and `switch` on it.** Then more.")).toEqual([
      {
        kind: "bold",
        runs: [
          { kind: "text", text: "Give each variant a literal " },
          { kind: "code", text: "kind" },
          { kind: "text", text: ", and " },
          { kind: "code", text: "switch" },
          { kind: "text", text: " on it." },
        ],
      },
      { kind: "text", text: " Then more." },
    ]);
  });

  it("a lone backtick inside bold stays as text", () => {
    expect(splitInline("**a ` b**")).toEqual([{ kind: "bold", runs: [{ kind: "text", text: "a ` b" }] }]);
  });

  it("returns nothing for empty text", () => {
    expect(splitInline("")).toEqual([]);
  });
});
