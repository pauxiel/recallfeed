import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { getNotesBySourceId, upsertNote, upsertNotes } from "../notes";
import { upsertSource } from "../sources";
import { databaseUrl, makeNote, testDb, uniqueName } from "./helpers";

describe.skipIf(databaseUrl === "")("note queries (real PostgreSQL through the proxy)", () => {
  async function newSource() {
    return upsertSource(testDb(), { name: uniqueName("notes"), type: "markdown" });
  }

  it("creates a note with the Spec 01 shape and reports it as created", async () => {
    const db = testDb();
    const source = await newSource();
    const input = await makeNote(source.id, "first body", {
      title: "A title",
      metadata: { tags: ["a", "b"], author: "me" },
    });

    const { note, created } = await upsertNote(db, input);

    expect(created).toBe(true);
    expect(note).toMatchObject({
      sourceId: source.id,
      title: "A title",
      content: "first body",
      contentHash: input.contentHash,
      metadata: { tags: ["a", "b"], author: "me" },
    });
    expect(note.importedAt).toBeInstanceOf(Date);
  });

  it("re-import to the SAME source (reused source identity) keeps one row, refreshes imported_at and metadata, and never changes content", async () => {
    const db = testDb();
    const source = await newSource();
    const original = await makeNote(source.id, "stable body", { title: "v1", metadata: { rev: 1 } });
    const first = await upsertNote(db, original);

    // The same source id and the same hash, with a different title and metadata.
    const again = await upsertNote(db, { ...original, title: "v2", metadata: { rev: 2 } });

    expect(again.created).toBe(false);
    expect(again.note.id).toBe(first.note.id);
    expect(again.note.content).toBe("stable body");
    expect(again.note.title).toBe("v2");
    expect(again.note.metadata).toEqual({ rev: 2 });
    expect(again.note.importedAt.getTime()).toBeGreaterThan(first.note.importedAt.getTime());
    const rows = await getNotesBySourceId(db, source.id);
    expect(rows).toHaveLength(1);
  });

  it("content is immutable: a conflicting row never overwrites stored content", async () => {
    const db = testDb();
    const source = await newSource();
    const original = await makeNote(source.id, "the original text");
    await upsertNote(db, original);

    // A caller that lies: same hash, different content. The stored content must not change.
    const lying = { ...original, content: "TAMPERED CONTENT" };
    const result = await upsertNote(db, lying);

    expect(result.created).toBe(false);
    expect(result.note.content).toBe("the original text");
  });

  it("deduplication is source-scoped: the same hash in two sources makes two notes", async () => {
    const db = testDb();
    const a = await newSource();
    const b = await newSource();
    const one = await upsertNote(db, await makeNote(a.id, "shared text"));
    const two = await upsertNote(db, await makeNote(b.id, "shared text"));

    expect(one.created).toBe(true);
    expect(two.created).toBe(true);
    expect(one.note.id).not.toBe(two.note.id);
    expect(one.note.contentHash).toBe(two.note.contentHash);
    expect(await getNotesBySourceId(db, a.id)).toHaveLength(1);
    expect(await getNotesBySourceId(db, b.id)).toHaveLength(1);
  });

  it("upsertNotes stores a whole batch in one call and flags only the new notes", async () => {
    const db = testDb();
    const source = await newSource();
    const batch = await Promise.all(["alpha", "beta", "gamma"].map((text) => makeNote(source.id, text)));

    const first = await upsertNotes(db, source.id, batch);
    expect(first.map((entry) => entry.created)).toEqual([true, true, true]);
    expect(first.map((entry) => entry.note.content)).toEqual(["alpha", "beta", "gamma"]);

    const more = [...batch, await makeNote(source.id, "delta")];
    const second = await upsertNotes(db, source.id, more);
    expect(second.map((entry) => entry.created)).toEqual([false, false, false, true]);
    expect(await getNotesBySourceId(db, source.id)).toHaveLength(4);
  });

  it("collapses duplicate hashes inside one batch instead of failing", async () => {
    const db = testDb();
    const source = await newSource();
    const same = await makeNote(source.id, "twice");

    const result = await upsertNotes(db, source.id, [same, { ...same, title: "ignored duplicate" }]);

    expect(result).toHaveLength(1);
    expect(result[0]?.created).toBe(true);
  });

  it("an empty batch makes no change and returns an empty list", async () => {
    const db = testDb();
    const source = await newSource();
    expect(await upsertNotes(db, source.id, [])).toEqual([]);
  });

  it("rejects a note that names a different source, and a malformed source id", async () => {
    const db = testDb();
    const source = await newSource();
    const other = await newSource();
    const stray = await makeNote(other.id, "stray");

    await expect(upsertNotes(db, source.id, [stray])).rejects.toBeInstanceOf(ValidationError);
    await expect(upsertNotes(db, "not-a-uuid", [])).rejects.toBeInstanceOf(ValidationError);
  });

  it("stores hostile content as data and keeps tables intact", async () => {
    const db = testDb();
    const source = await newSource();
    const text = "'); DROP TABLE notes; -- \"quotes\" and $1 and unicode ✓ 漢字";

    const { note } = await upsertNote(db, await makeNote(source.id, text));

    expect(note.content).toBe(text);
    const table = await db.query("SELECT to_regclass('public.notes') IS NOT NULL AS present");
    expect(table[0]?.present).toBe(true);
  });

  it("getNotesBySourceId returns [] for an unknown or malformed source id", async () => {
    const db = testDb();
    expect(await getNotesBySourceId(db, "00000000-0000-0000-0000-000000000000")).toEqual([]);
    expect(await getNotesBySourceId(db, "nope")).toEqual([]);
  });
});
