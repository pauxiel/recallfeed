import { RecallFeedError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { getSnoozeHours } from "../snooze-config";

describe("getSnoozeHours", () => {
  it("is 24 hours when the variable is unset or blank (Spec 04)", () => {
    expect(getSnoozeHours({})).toBe(24);
    expect(getSnoozeHours({ SNOOZE_DEFAULT_HOURS: undefined })).toBe(24);
    expect(getSnoozeHours({ SNOOZE_DEFAULT_HOURS: "" })).toBe(24);
  });

  it.each([
    ["1", 1],
    ["6", 6],
    ["24", 24],
    ["72", 72],
    ["168", 168],
    ["8760", 8760],
  ])("reads %s as %i hours", (raw, hours) => {
    expect(getSnoozeHours({ SNOOZE_DEFAULT_HOURS: raw })).toBe(hours);
  });

  it.each([
    "0",
    "-1",
    "8761",
    "99999",
    "24.0",
    "1.5",
    "1e1",
    "0x10",
    " 12",
    "12 ",
    "+5",
    "012",
    "twelve",
    "NaN",
    "Infinity",
    "24h",
    "١٢",
    " ",
  ])("refuses %j as a configuration error instead of guessing", (raw) => {
    const failure = (() => {
      try {
        getSnoozeHours({ SNOOZE_DEFAULT_HOURS: raw });
        return null;
      } catch (error) {
        return error;
      }
    })();

    expect(failure).toBeInstanceOf(RecallFeedError);
    expect((failure as RecallFeedError).code).toBe("INTERNAL_CONFIG");
  });

  it("never puts the configured value in the error, so it cannot reach a response or a log", () => {
    const secretLooking = "hunter2-not-a-number";

    try {
      getSnoozeHours({ SNOOZE_DEFAULT_HOURS: secretLooking });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(secretLooking);
    }
  });
});
