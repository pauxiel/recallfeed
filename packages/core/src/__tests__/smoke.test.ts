import { describe, expect, it } from "vitest";

// Smoke test for the toolchain: proves Vitest is executing inside the Workers
// runtime (workerd via Miniflare), not in plain Node.
describe("Workers runtime smoke test", () => {
  it("exposes the Workers runtime user agent", () => {
    expect(navigator.userAgent).toBe("Cloudflare-Workers");
  });

  it("generates RFC 4122 UUIDs with the global crypto.randomUUID()", () => {
    // workers-types declares `crypto` as a global const, which TypeScript does not
    // expose as a property of `typeof globalThis`. Reflect.get checks that the
    // global and `globalThis.crypto` are the same object without a type cast.
    expect(Reflect.get(globalThis, "crypto")).toBe(crypto);

    const id = crypto.randomUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(crypto.randomUUID()).not.toBe(id);
  });

  it("provides Workers-only globals that plain Node does not have", () => {
    expect(typeof WebSocketPair).toBe("function");
    expect(typeof HTMLRewriter).toBe("function");
  });
});
