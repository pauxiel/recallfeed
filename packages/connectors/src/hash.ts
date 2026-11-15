/**
 * SHA-256 of a string as lowercase hex, using Web Crypto as the Workers runtime provides it.
 *
 * Spec 03's sketch calls `crypto.subtle.digestSync`, which does not exist in Workers. The real
 * API is the asynchronous `crypto.subtle.digest`.
 *
 * @param value - The text to hash, encoded as UTF-8.
 * @returns 64 lowercase hexadecimal characters.
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
