import { ValidationError } from "@recallfeed/core";

/**
 * Reads at most `limit` bytes of a request body.
 *
 * Stops reading as soon as the limit is passed instead of buffering everything, and checks
 * `Content-Length` first so an honest oversize request costs nothing.
 *
 * @returns The bytes, or null if the body is larger than `limit`.
 */
export async function readBounded(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > limit) {
    return null;
  }
  if (request.body === null) {
    return new Uint8Array(0);
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    // The Workers typings mark both options as required; false is the standard default for BOM handling.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new ValidationError("Body is not valid UTF-8 text", "VALIDATION_ENCODING");
  }
}
