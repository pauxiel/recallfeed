/**
 * Public API of `@recallfeed/connectors`.
 *
 * Importing this module registers the built-in connectors in `connectorRegistry` (Spec 03).
 * The Notion connector is deferred to Gate 4, so `connectorRegistry.get("notion")` throws
 * `CONNECTOR_NOT_FOUND` until it exists.
 */
import { MarkdownConnector } from "./markdown";
import { connectorRegistry } from "./registry";

connectorRegistry.register(new MarkdownConnector());

export { ConnectorRegistry, connectorRegistry } from "./registry";
export { MARKDOWN_MAX_BYTES, MARKDOWN_MIN_BYTES, MarkdownConnector } from "./markdown";
export { parseFrontmatter } from "./frontmatter";
export type { Frontmatter, ParsedDocument } from "./frontmatter";
export { sha256Hex } from "./hash";
