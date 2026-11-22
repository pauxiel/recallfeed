import type { Note } from "@recallfeed/core";
import type { NewFeedItem } from "@recallfeed/database";

/** A fence opener or closer: three or more backticks or tildes at the start of a line, after up to 3 spaces. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Splits text into lines, each marked as inside a fenced code block or not. Fences themselves count as code. */
function linesOutsideCode(content: string): { text: string; code: boolean }[] {
  const out: { text: string; code: boolean }[] = [];
  let open: string | null = null;
  for (const text of content.replace(/\r\n?/g, "\n").split("\n")) {
    const match = FENCE.exec(text);
    if (open === null) {
      if (match !== null) {
        open = match[1] as string;
        out.push({ text, code: true });
      } else {
        out.push({ text, code: false });
      }
      continue;
    }
    out.push({ text, code: true });
    // A fence closes with the same character, at least as long as the opener, and nothing else on the line.
    if (match !== null && (match[1] as string)[0] === open[0] && (match[1] as string).length >= open.length && text.trim() === match[1]) {
      open = null;
    }
  }
  return out;
}

/** The first blockquote outside code: its lines with every leading `>` marker removed, trimmed. */
function firstQuote(lines: { text: string; code: boolean }[]): string | null {
  const start = lines.findIndex((line) => !line.code && /^ {0,3}>/.test(line.text));
  if (start === -1) {
    return null;
  }
  const quoted: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i] as { text: string; code: boolean };
    if (line.code || !/^ {0,3}>/.test(line.text)) {
      break;
    }
    quoted.push(line.text.replace(/^ {0,3}(?:> ?)+/, ""));
  }
  const text = quoted.join("\n").trim();
  return text === "" ? null : text;
}

/**
 * Strong then emphasis delimiters. The text must not start or end with a space, as in CommonMark. The `d` flag
 * gives the position of the captured text, so it can be read from the original line (see {@link emphasized}).
 */
const EMPHASIS = [
  /\*\*(?! )([^*\n]+?)(?<! )\*\*/gd,
  /(?<![\p{L}\p{N}_])__(?! )([^_\n]+?)(?<! )__(?![\p{L}\p{N}_])/gud,
  /(?<!\*)\*(?![ *])([^*\n]+?)(?<![ *])\*(?!\*)/gd,
  /(?<![\p{L}\p{N}_])_(?![ _])([^_\n]+?)(?<![ _])_(?![\p{L}\p{N}_])/gud,
];

/**
 * What stands in for inline code while emphasis is matched. It is not a space, so emphasis that starts or ends
 * with code (`**`pnpm seed` loads it**`) still counts as emphasis, and it is not a letter, digit, `*` or `_`, so it
 * neither blocks nor makes a delimiter. It is never shown: the card text is read from the original line.
 */
const CODE_MASK = ".";

/** Every emphasized span outside code, in document order, without repeats. Inline code inside a span is kept. */
function emphasized(lines: { text: string; code: boolean }[]): string | null {
  const spans: { at: number; text: string }[] = [];
  let offset = 0;
  for (const line of lines) {
    if (!line.code) {
      // Inline code is not emphasis, so a `*` or `_` inside it must not pair with anything. Match on a copy where
      // each code span is masked (same length, so positions line up), then read the text from the original line.
      const prose = line.text.replace(/`+[^`]*`+/g, (code) => CODE_MASK.repeat(code.length));
      const taken = new Array<boolean>(prose.length).fill(false);
      for (const pattern of EMPHASIS) {
        for (const match of prose.matchAll(pattern)) {
          const index = match.index ?? 0;
          const end = index + match[0].length;
          if (taken.slice(index, end).some(Boolean)) {
            continue;
          }
          taken.fill(true, index, end);
          const inner = match.indices?.[1];
          const text = inner === undefined ? "" : line.text.slice(inner[0], inner[1]).trim();
          if (text !== "") {
            spans.push({ at: offset + index, text });
          }
        }
      }
    }
    offset += line.text.length + 1;
  }
  const unique = [...new Set(spans.sort((a, b) => a.at - b.at).map((span) => span.text))];
  return unique.length === 0 ? null : unique.join("\n");
}

/**
 * The text a highlight card shows for a note, or null when the note has nothing to highlight (Task 28).
 *
 * Rules, in order:
 * 1. The first blockquote, with its `>` markers removed. Quoted text is what the author chose to quote.
 * 2. Otherwise, every emphasized span (`**strong**`, `__strong__`, `*em*`, `_em_`) in document order,
 *    one per line, without repeats.
 * 3. Otherwise null: no highlight card. Spec 04's sketch falls back to the first long paragraph, but that
 *    would mostly repeat the original card, so a note without a quote or emphasis gets no highlight.
 *
 * Fenced code blocks and inline code are never treated as quotes or emphasis, but inline code inside an
 * emphasized span stays in the highlight as written. No clock, randomness,
 * network or AI is involved, so the same note always gives the same highlight.
 *
 * @param content - A note's Markdown content.
 * @returns The highlight text, or null.
 */
export function extractHighlight(content: string): string | null {
  const lines = linesOutsideCode(content);
  return firstQuote(lines) ?? emphasized(lines);
}

/**
 * The deterministic "highlight" card: the quoted or emphasized part of a note (Task 28).
 *
 * @param note - A stored note.
 * @returns The card to create, or null if the note has nothing to highlight.
 */
export function generateHighlightCard(note: Note): NewFeedItem | null {
  const content = extractHighlight(note.content);
  if (content === null) {
    return null;
  }
  return { noteId: note.id, sourceId: note.sourceId, cardType: "highlight", content, isAiGenerated: false };
}
