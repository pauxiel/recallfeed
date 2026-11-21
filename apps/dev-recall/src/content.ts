/**
 * Turns a card's Markdown-ish text into plain data the UI can render without ever building HTML from it.
 *
 * Rendering stays inside React's escaping: these functions return data, never markup, so note content
 * (which anyone with the API key can import) cannot inject HTML or script into the page.
 */

/** One block of a card: a paragraph of text, or a fenced code block. */
export type Block =
  | { kind: "text"; text: string }
  | { kind: "code"; language: string; code: string };

/** A run that cannot contain other runs: plain text or inline code. */
export type Leaf = { kind: "text"; text: string } | { kind: "code"; text: string };

/** One run inside a paragraph. Bold may contain inline code, which is common in technical writing. */
export type Inline = Leaf | { kind: "bold"; runs: Leaf[] };

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;

/**
 * Splits card content into paragraphs and fenced code blocks.
 *
 * A fence is three or more backticks or tildes, indented at most three spaces, and it closes with the
 * same character at least as long. An unclosed fence runs to the end of the content. Blank lines separate
 * paragraphs; a paragraph keeps its own line breaks. Empty blocks are dropped.
 *
 * @param content - The card's text.
 * @returns The blocks in order.
 */
export function splitBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let code: { fence: string; language: string; lines: string[] } | null = null;

  const flushParagraph = (): void => {
    const text = paragraph.join("\n").trim();
    if (text !== "") blocks.push({ kind: "text", text });
    paragraph = [];
  };

  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    if (code !== null) {
      const closing = new RegExp(`^ {0,3}${code.fence[0] === "`" ? "`" : "~"}{${code.fence.length},}\\s*$`);
      if (closing.test(line)) {
        blocks.push({ kind: "code", language: code.language, code: code.lines.join("\n") });
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }
    const open = FENCE.exec(line);
    if (open !== null) {
      flushParagraph();
      code = { fence: open[1] ?? "```", language: open[2] ?? "", lines: [] };
    } else if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }
  if (code !== null) {
    blocks.push({ kind: "code", language: code.language, code: code.lines.join("\n") });
  }
  flushParagraph();
  return blocks.filter((block) => (block.kind === "text" ? block.text !== "" : block.code.trim() !== ""));
}

/** Splits text into plain text and `inline code`. A lone backtick stays as text. */
function splitCode(text: string): Leaf[] {
  const runs: Leaf[] = [];
  let last = 0;
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const start = match.index ?? 0;
    if (start > last) runs.push({ kind: "text", text: text.slice(last, start) });
    runs.push({ kind: "code", text: match[1] ?? "" });
    last = start + match[0].length;
  }
  if (last < text.length) runs.push({ kind: "text", text: text.slice(last) });
  return runs;
}

/**
 * Splits a paragraph into plain text, `**bold**` and `inline code`.
 *
 * Only a complete pair counts: a lone `**` or backtick stays as text. Bold may contain inline code but
 * not more bold, and it does not span a line break. Backticks inside bold are read first as code, so
 * `**use \`Result\`**` is one bold run holding one code run.
 *
 * @param text - One paragraph.
 * @returns The runs in order.
 */
export function splitInline(text: string): Inline[] {
  const runs: Inline[] = [];
  // Bold first (it may contain backticks), then a standalone code span.
  const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) runs.push({ kind: "text", text: text.slice(last, start) });
    if (match[1] !== undefined) runs.push({ kind: "bold", runs: splitCode(match[1]) });
    else runs.push({ kind: "code", text: match[2] ?? "" });
    last = start + match[0].length;
  }
  if (last < text.length) runs.push({ kind: "text", text: text.slice(last) });
  return runs;
}
