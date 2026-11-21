import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { parseImportCardTypes } from "../card-types";

describe("parseImportCardTypes: which cards an import creates", () => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["blank", "   "],
  ])("%s means original only, as before the setting existed", (_label, raw) => {
    expect(parseImportCardTypes(raw)).toEqual(["original"]);
  });

  it.each<[string, string, string[]]>([
    ["original and highlight", "original,highlight", ["original", "highlight"]],
    ["spaces around names", " original , highlight ", ["original", "highlight"]],
    ["highlight alone still keeps original, first", "highlight", ["original", "highlight"]],
    ["repeats collapse", "highlight,original,highlight", ["original", "highlight"]],
    ["original alone", "original", ["original"]],
  ])("%s", (_label, raw, expected) => {
    expect(parseImportCardTypes(raw)).toEqual(expected);
  });

  it.each<[string, string, string[]]>([
    ["an AI-generated type (reflection_prompt) is skipped", "original,highlight,reflection_prompt", ["original", "highlight"]],
    ["summary (AI) and code_snippet (no generator yet) are skipped", "original,summary,code_snippet", ["original"]],
  ])("%s", (_label, raw, expected) => {
    expect(parseImportCardTypes(raw)).toEqual(expected);
  });

  it.each([
    ["an unknown name", "original,quote"],
    ["a differently cased name", "original,Highlight"],
    ["an empty entry", "original,,highlight"],
    ["a trailing comma", "original,highlight,"],
  ])("refuses %s with VALIDATION_CARD_TYPE, without echoing the value", (_label, raw) => {
    let thrown: unknown;
    try {
      parseImportCardTypes(raw);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).code).toBe("VALIDATION_CARD_TYPE");
    expect((thrown as ValidationError).message).not.toContain(raw);
  });
});
