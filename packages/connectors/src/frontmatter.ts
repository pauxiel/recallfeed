/** The frontmatter fields the Markdown connector understands (Spec 03). */
export type Frontmatter = {
  title?: string;
  tags?: string[];
  author?: string;
  /** ISO 8601 UTC timestamp, present only if the `date` field parsed as a date. */
  date?: string;
};

/** The result of splitting a document into frontmatter and body. */
export type ParsedDocument = {
  frontmatter: Frontmatter;
  body: string;
};

const FRONTMATTER = /^---\n([\s\S]+?)\n---(?:\n([\s\S]*))?$/;

function unquote(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if (trimmed.length >= 2 && (quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Splits optional YAML frontmatter from the body.
 *
 * This is the MVP subset Spec 03 describes: `key: value` lines only, with `title`, `tags` (an
 * inline `[a, b]` list), `author`, and `date`. There are no nested values, multiline values, or
 * other YAML features. Frontmatter that does not contain a single recognized `key: value`
 * line is not frontmatter, and the whole text stays the body, so a `---` rule never swallows
 * content. Input must already use `\n` line endings.
 *
 * @param text - The full Markdown document.
 * @returns The recognized frontmatter fields and the remaining body.
 */
export function parseFrontmatter(text: string): ParsedDocument {
  const match = FRONTMATTER.exec(text);
  if (match === null) {
    return { frontmatter: {}, body: text };
  }
  const frontmatter: Frontmatter = {};
  let recognized = false;
  for (const line of (match[1] ?? "").split("\n")) {
    const colon = line.indexOf(":");
    if (colon <= 0) {
      continue;
    }
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim();
    switch (key) {
      case "title":
        frontmatter.title = unquote(raw);
        recognized = true;
        break;
      case "author":
        frontmatter.author = unquote(raw);
        recognized = true;
        break;
      case "tags":
        if (raw.startsWith("[") && raw.endsWith("]")) {
          frontmatter.tags = raw
            .slice(1, -1)
            .split(",")
            .map(unquote)
            .filter((tag) => tag !== "");
          recognized = true;
        }
        break;
      case "date": {
        const parsed = Date.parse(unquote(raw));
        if (!Number.isNaN(parsed)) {
          frontmatter.date = new Date(parsed).toISOString();
          recognized = true;
        }
        break;
      }
      default:
        break;
    }
  }
  if (!recognized) {
    return { frontmatter: {}, body: text };
  }
  return { frontmatter, body: match[2] ?? "" };
}
