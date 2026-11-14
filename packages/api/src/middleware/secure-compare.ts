/**
 * Compares two secrets without leaking, through timing, where they first differ or how long they are.
 *
 * Both values are hashed to a fixed length with SHA-256 first, then every byte of the two digests
 * is compared with no early exit.
 *
 * @param provided - A value from the request.
 * @param expected - The configured secret.
 * @returns True only if the strings are identical.
 */
export async function secureEqual(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}
