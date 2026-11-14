import type { Note } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { generateOriginalCard } from "../generators/original";

const note: Note = {
  id: "22222222-2222-4222-8222-222222222222",
  sourceId: "11111111-1111-4111-8111-111111111111",
  title: "A title",
  content: "The note body, exactly as imported.\n\n- with a list",
  contentHash: "a".repeat(64),
  metadata: { tags: ["x"] },
  importedAt: new Date(1),
  updatedAt: new Date(2),
};

describe("generateOriginalCard", () => {
  it("copies the note one-to-one: same content, same note, same source", () => {
    expect(generateOriginalCard(note)).toEqual({
      noteId: note.id,
      sourceId: note.sourceId,
      cardType: "original",
      content: note.content,
      isAiGenerated: false,
    });
  });

  it("is deterministic and never AI-generated", () => {
    expect(generateOriginalCard(note)).toEqual(generateOriginalCard(note));
    expect(generateOriginalCard(note).isAiGenerated).toBe(false);
  });

  it("does not leak the title, metadata, or timestamps into the card", () => {
    const keys = Object.keys(generateOriginalCard(note)).sort();

    expect(keys).toEqual(["cardType", "content", "isAiGenerated", "noteId", "sourceId"]);
  });
});
