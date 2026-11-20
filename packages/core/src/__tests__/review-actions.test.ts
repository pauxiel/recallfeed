import { describe, expect, it } from "vitest";
import { REVIEW_ACTIONS, isReviewAction } from "../index";
import type { AllReviewActionsListed, ReviewAction } from "../index";

// Compile-time: this line stops typechecking if a ReviewAction is missing from REVIEW_ACTIONS.
const everyActionListed: AllReviewActionsListed = true;

// Compile-time: a Record keyed by ReviewAction must name every action, so adding one to the type
// without updating this test also fails to typecheck.
const expectedActions: Record<ReviewAction, true> = {
  reviewed: true,
  saved: true,
  unsaved: true,
  snoozed: true,
  published: true,
  unpublished: true,
};

describe("REVIEW_ACTIONS", () => {
  it("lists exactly the six approved actions, once each", () => {
    expect(everyActionListed).toBe(true);
    expect([...REVIEW_ACTIONS].sort()).toEqual(Object.keys(expectedActions).sort());
    expect(new Set(REVIEW_ACTIONS).size).toBe(REVIEW_ACTIONS.length);
  });
});

describe("isReviewAction", () => {
  it.each(REVIEW_ACTIONS)("accepts %s", (action) => {
    expect(isReviewAction(action)).toBe(true);
  });

  it.each([
    "invalid",
    "",
    "Reviewed",
    "REVIEWED",
    " reviewed",
    "reviewed ",
    "publish",
    "snooze",
    "delete",
    "constructor",
    "__proto__",
    "toString",
  ])("rejects the string %j", (value) => {
    expect(isReviewAction(value)).toBe(false);
  });

  it.each([undefined, null, 0, 1, true, {}, [], ["reviewed"], { action: "reviewed" }])(
    "rejects the non-string %j",
    (value) => {
      expect(isReviewAction(value)).toBe(false);
    },
  );
});
