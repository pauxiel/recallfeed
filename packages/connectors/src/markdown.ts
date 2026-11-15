import { ConnectorError } from "@recallfeed/core";
import type {
  ConnectorCredentials,
  ConnectorValidationResult,
  IConnector,
  NormalizedNote,
  NoteMetadata,
  Source,
} from "@recallfeed/core";
import { lexer } from "marked";
import type { Token, Tokens } from "marked";
import { parseFrontmatter } from "./frontmatter";
import type { Frontmatter } from "./frontmatter";
import { sha256Hex } from "./hash";

/** Smallest Markdown import the API accepts (Spec 05). Enforced by the engine and the API. */
export const MARKDOWN_MIN_BYTES = 10;

/** Largest Markdown import (Spec 03, Spec 05). An input bound, not proof of CPU compliance. */
export const MARKDOWN_MAX_BYTES = 100 * 1024;

type Section = {
  title: string | null;
  parts: string[];
  metadata: NoteMetadata;
};

type Card = {
  title: string | null;
  content: string;
  metadata: NoteMetadata;
};

/** Wraps code in a fence long enough that backticks inside the code cannot close it early. */
function fence(code: string, language: string | undefined): string {
  let ticks = "```";
  while (code.includes(ticks)) {
    ticks += "`";
  }
  return `${ticks}${language ?? ""}\n${code}\n${ticks}`;
}

function renderBlockquote(token: Tokens.Blockquote): string {
  return token.text
    .split("\n")
    .map((line) => (line === "" ? ">" : `> ${line}`))
    .join("\n");
}

function renderList(token: Tokens.List): string {
  return token.items
    .map((item, index) => {
      const marker = token.ordered ? `${index + 1}.` : "-";
      const [first = "", ...rest] = item.text.split("\n");
      return [`${marker} ${first}`, ...rest.map((line) => `  ${line}`)].join("\n");
    })
    .join("\n");
}

/**
 * Turns marked tokens into reusable card candidates (Spec 03).
 *
 * A level 1 or 2 heading starts a new card. Content before the first heading becomes a card of
 * its own, so leading quotes, code, and lists are kept. Headings inside fenced code are code, not
 * section breaks, because the lexer has already tokenized them as code. Sections with no body are
 * dropped. The rules do not depend on any application.
 */
function extractCards(tokens: readonly Token[]): Card[] {
  const cards: Card[] = [];
  let current: Section | null = null;

  const flush = (): void => {
    if (current !== null && current.parts.length > 0) {
      cards.push({
        title: current.title,
        content: current.parts.join("\n\n").trim(),
        metadata: current.metadata,
      });
    }
  };
  const ensure = (): Section => {
    current ??= { title: null, parts: [], metadata: {} };
    return current;
  };

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const heading = token as Tokens.Heading;
        if (heading.depth <= 2) {
          flush();
          current = { title: heading.text, parts: [], metadata: { headingLevel: heading.depth } };
        } else {
          // Spec 03 drops a heading of level 3 or deeper that appears before any section.
          // It is content, so it starts an untitled section instead of being lost.
          ensure().parts.push(`${"#".repeat(heading.depth)} ${heading.text}`);
        }
        break;
      }
      case "paragraph":
        ensure().parts.push((token as Tokens.Paragraph).text);
        break;
      case "blockquote": {
        const section = ensure();
        section.parts.push(renderBlockquote(token as Tokens.Blockquote));
        section.metadata.hasBlockquote = true;
        break;
      }
      case "code": {
        const code = token as Tokens.Code;
        const section = ensure();
        section.parts.push(fence(code.text, code.lang));
        section.metadata.hasCodeBlock = true;
        if (code.lang !== undefined && code.lang !== "") {
          section.metadata.codeLanguage = code.lang;
        }
        break;
      }
      case "list":
        ensure().parts.push(renderList(token as Tokens.List));
        break;
      case "table":
        // Spec 03 does not list tables. Dropping one would silently lose the user's content,
        // and its raw form is already Markdown, so it is kept as-is.
        ensure().parts.push((token as Tokens.Table).raw.trim());
        break;
      default:
        // space, hr, html, and the rest: structural or not representable as Markdown text.
        break;
    }
  }
  flush();
  return cards;
}

/**
 * Tokenizes Markdown, degrading instead of failing.
 *
 * The `marked` lexer recurses once per nesting level, so a few kilobytes of nested blockquote or
 * list markers (about 2,000 `>` or 10,000 `- `) overflow the call stack and throw a `RangeError`.
 * Spec 03 says odd Markdown is never an error, and the input here comes from a public endpoint.
 * Only that overflow is caught, and the text becomes one plain paragraph so no content is lost.
 * Any other error is a real bug and still propagates.
 */
function tokenize(body: string): Token[] {
  try {
    return lexer(body);
  } catch (error) {
    if (error instanceof RangeError) {
      const text = body.trim();
      return text === "" ? [] : [{ type: "paragraph", raw: text, text, tokens: [] }];
    }
    throw error;
  }
}

function noteMetadata(frontmatter: Frontmatter, card: Card): NoteMetadata {
  // Optional keys are omitted, never set to undefined, so equal input gives equal output.
  const metadata: NoteMetadata = { tags: frontmatter.tags ?? [] };
  if (frontmatter.author !== undefined) {
    metadata.author = frontmatter.author;
  }
  // Spec 03's sketch falls back to the current time, which makes two imports of the same text
  // differ. The date is recorded only when the document supplies one.
  if (frontmatter.date !== undefined) {
    metadata.sourceCreatedAt = frontmatter.date;
  }
  return { ...metadata, ...card.metadata };
}

/**
 * Turns Markdown text into notes. The text arrives in `credentials.content`; this connector
 * never reads the filesystem, the network, the database, or the environment.
 */
export class MarkdownConnector implements IConnector {
  readonly type = "markdown" as const;

  /**
   * The Markdown connector has no external dependency to check.
   *
   * @returns Always valid.
   */
  validate(): Promise<ConnectorValidationResult> {
    return Promise.resolve({ valid: true, description: "Markdown connector ready" });
  }

  /**
   * Parses Markdown into one note per card.
   *
   * Deterministic: the same content always yields the same notes and hashes. Markdown that is
   * odd or malformed is never an error; the connector extracts what it can.
   *
   * @param source - The source the notes belong to. Only its `id` is used.
   * @param credentials - `content` holds the Markdown text.
   * @returns The notes, in document order. Empty if the text has no extractable content.
   * @throws ConnectorError `MARKDOWN_NO_CONTENT` if `credentials.content` is missing or empty.
   * @throws ConnectorError `MARKDOWN_TOO_LARGE` if the content exceeds {@link MARKDOWN_MAX_BYTES}.
   */
  async import(source: Source, credentials: ConnectorCredentials): Promise<NormalizedNote[]> {
    const content = credentials.content;
    if (content === undefined || content === "") {
      throw new ConnectorError(
        "Markdown connector requires content in credentials.content",
        "MARKDOWN_NO_CONTENT",
      );
    }
    const sizeBytes = new TextEncoder().encode(content).length;
    if (sizeBytes > MARKDOWN_MAX_BYTES) {
      throw new ConnectorError(
        `Markdown content too large: ${sizeBytes} bytes (maximum ${MARKDOWN_MAX_BYTES})`,
        "MARKDOWN_TOO_LARGE",
      );
    }

    const text = content.replace(/\r\n?/g, "\n");
    const { frontmatter, body } = parseFrontmatter(text);
    const cards = extractCards(tokenize(body));

    return Promise.all(
      cards.map(async (card): Promise<NormalizedNote> => ({
        sourceId: source.id,
        title: card.title ?? frontmatter.title ?? null,
        content: card.content,
        contentHash: await sha256Hex(card.content),
        metadata: noteMetadata(frontmatter, card),
      })),
    );
  }
}
