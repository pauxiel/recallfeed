/** Where the API runs when no address is configured: the local API from `pnpm dev:api`. */
export const DEFAULT_API_URL = "http://127.0.0.1:8788";

/**
 * The API's public address: `VITE_API_URL` at build time, else the local default.
 *
 * This is the only setting the browser app reads. It is an address, not a credential: the app is public,
 * read-only, and never holds an API key.
 */
export function apiBaseUrl(): string {
  const configured: unknown = import.meta.env.VITE_API_URL;
  return typeof configured === "string" && configured.trim() !== "" ? configured.trim() : DEFAULT_API_URL;
}
