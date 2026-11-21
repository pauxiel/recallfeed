import { describe, expect, it } from "vitest";
import type { RecallFeedClient } from "@recallfeed/client";
import { publishCards } from "../publish-cards";

type Call = { id: string; action: string };

/** A stand-in client whose review fails for the IDs in `failing`. */
function fakeClient(failing: string[] = []): Pick<RecallFeedClient, "review"> & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async review(id, action) {
      calls.push({ id, action });
      if (failing.includes(id)) throw new Error(`cannot publish ${id}`);
      return { id, reviewCount: 0, lastReviewedAt: null, savedAt: null, snoozedUntil: null, isPublished: true };
    },
  };
}

describe("publishCards", () => {
  it("publishes every card, in order, through the published action", async () => {
    const client = fakeClient();

    const outcome = await publishCards(client, ["a", "b", "c"]);

    expect(client.calls).toEqual([
      { id: "a", action: "published" },
      { id: "b", action: "published" },
      { id: "c", action: "published" },
    ]);
    expect(outcome).toEqual({ published: ["a", "b", "c"], notAttempted: [] });
  });

  it("an empty list does nothing", async () => {
    const client = fakeClient();

    expect(await publishCards(client, [])).toEqual({ published: [], notAttempted: [] });
    expect(client.calls).toEqual([]);
  });

  it("stops at the first failure and reports what was published, what failed and what was never tried", async () => {
    const client = fakeClient(["c"]);

    const outcome = await publishCards(client, ["a", "b", "c", "d", "e"]);

    expect(outcome.published).toEqual(["a", "b"]);
    expect(outcome.failed?.id).toBe("c");
    expect((outcome.failed?.error as Error).message).toBe("cannot publish c");
    expect(outcome.notAttempted).toEqual(["d", "e"]);
    expect(client.calls.map((call) => call.id)).toEqual(["a", "b", "c"]);
  });

  it("a failure on the first card publishes nothing and leaves the rest untried", async () => {
    const outcome = await publishCards(fakeClient(["a"]), ["a", "b"]);

    expect(outcome.published).toEqual([]);
    expect(outcome.notAttempted).toEqual(["b"]);
  });

  it("a failure on the last card leaves nothing untried", async () => {
    const outcome = await publishCards(fakeClient(["b"]), ["a", "b"]);

    expect(outcome.published).toEqual(["a"]);
    expect(outcome.failed?.id).toBe("b");
    expect(outcome.notAttempted).toEqual([]);
  });

  it("reports progress after each published card, counting from one", async () => {
    const seen: [string, number][] = [];

    await publishCards(fakeClient(["c"]), ["a", "b", "c"], (id, position) => seen.push([id, position]));

    expect(seen).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("does not change the list it was given", async () => {
    const ids = ["a", "b", "c"];

    await publishCards(fakeClient(["b"]), ids);

    expect(ids).toEqual(["a", "b", "c"]);
  });
});
