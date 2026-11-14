import type { Source } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { MarkdownConnector } from "../markdown";

// Informational benchmark (project convention for CPU-sensitive code). It logs numbers and never
// gates CI on them.
//
// WHAT THIS MEASURES: wall-clock time of the synchronous parse-and-hash work, in the local Workers
// runtime (workerd under Miniflare) on this machine. In this runtime timers do advance during CPU
// work (checked directly), so elapsed time here is close to CPU time for this pure computation.
//
// WHAT THIS DOES NOT MEASURE: Cloudflare's billed CPU time. Production Workers freeze timers during
// CPU work, the local machine is not Cloudflare hardware, and this excludes the HTTP, database
// round-trips, and card creation of a full import. It cannot show that the free-tier 10 ms budget is
// met. See the full-path measurement in the API package for the end-to-end figures.

const source: Source = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "bench",
  type: "markdown",
  config: {},
  isActive: true,
  lastSyncedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const connector = new MarkdownConnector();

/** Builds Markdown of about `bytes` bytes from repeated sections. */
function build(bytes: number, shape: "prose" | "code" | "mixed"): string {
  const prose = "A paragraph of ordinary note text with `inline code`, **bold**, and a [link](https://example.com).\n\n";
  const code = "```ts\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n```\n\n";
  const list = "- first item\n- second item\n  - nested item\n- third item\n\n";
  let out = "";
  let n = 0;
  while (new TextEncoder().encode(out).length < bytes) {
    n += 1;
    const body = shape === "prose" ? prose + prose : shape === "code" ? code + code : prose + code + list;
    out += `## Section ${n}\n\n${body}`;
  }
  const encoded = new TextEncoder().encode(out);
  return new TextDecoder().decode(encoded.slice(0, bytes)).replace(/\uFFFD+$/, "");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

describe("Markdown connector CPU benchmark (informational, local Workers runtime)", () => {
  const sizes = [1, 10, 50, 100].map((kb) => kb * 1024);
  const shapes = ["prose", "code", "mixed"] as const;

  it("logs parse-and-hash time per size and content shape", async () => {
    const rows: string[] = [];
    for (const shape of shapes) {
      for (const size of sizes) {
        const text = build(size, shape);
        const runs = size >= 50 * 1024 ? 15 : 40;
        await connector.import(source, { content: text }); // warm-up: JIT and first-use costs
        const times: number[] = [];
        let notes = 0;
        for (let i = 0; i < runs; i++) {
          const start = performance.now();
          const result = await connector.import(source, { content: text });
          times.push(performance.now() - start);
          notes = result.length;
        }
        rows.push(
          `${shape.padEnd(5)} ${String(Math.round(size / 1024)).padStart(3)} KB  notes=${String(notes).padStart(4)}  ` +
            `median=${median(times).toFixed(2).padStart(7)} ms  min=${Math.min(...times).toFixed(2).padStart(7)} ms  ` +
            `max=${Math.max(...times).toFixed(2).padStart(7)} ms  (n=${runs})`,
        );
        expect(notes).toBeGreaterThan(0);
      }
    }
    console.log(`\nMARKDOWN-BENCH (elapsed ms per import, local workerd, NOT Cloudflare billed CPU)\n${rows.join("\n")}\n`);
  });

  it("logs the cost of the hardest realistic shape: one note per tiny heading", async () => {
    const text = Array.from({ length: 4000 }, (_, i) => `# H${i}\n\nx`).join("\n\n").slice(0, 100 * 1024);
    await connector.import(source, { content: text });
    const times: number[] = [];
    let notes = 0;
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      notes = (await connector.import(source, { content: text })).length;
      times.push(performance.now() - start);
    }
    console.log(
      `\nMARKDOWN-BENCH many-notes: ${notes} notes from ${Math.round(text.length / 1024)} KB, ` +
        `median=${median(times).toFixed(2)} ms, max=${Math.max(...times).toFixed(2)} ms (n=10)\n`,
    );
    expect(notes).toBeGreaterThan(1000);
  });
});
