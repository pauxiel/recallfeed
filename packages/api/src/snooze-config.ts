import { RecallFeedError } from "@recallfeed/core";
import { MAX_SNOOZE_HOURS } from "@recallfeed/database";
import { DEFAULT_SNOOZE_HOURS } from "@recallfeed/feed-engine";
import type { Env } from "./types";

/**
 * Reads how long a `snoozed` action hides a card, from `SNOOZE_DEFAULT_HOURS` (Spec 04).
 *
 * Unset or blank means the default, 24 hours. A value that is set must be a plain whole number of
 * hours from 1 to 8760. Anything else is a deployment mistake, so it fails loudly with a generic 500
 * (the value is never echoed or logged) instead of silently snoozing for a length nobody chose. A
 * Wrangler variable is always a string, so `"24.0"`, `"1e1"`, `"0x10"`, `" 12"` and `"+5"` are refused.
 *
 * @param env - The Worker environment.
 * @returns The snooze length in hours.
 * @throws RecallFeedError `INTERNAL_CONFIG` if `SNOOZE_DEFAULT_HOURS` is set to an unusable value.
 */
export function getSnoozeHours(env: Pick<Env, "SNOOZE_DEFAULT_HOURS">): number {
  const raw = env.SNOOZE_DEFAULT_HOURS;
  if (raw === undefined || raw === "") {
    return DEFAULT_SNOOZE_HOURS;
  }
  if (!/^[1-9]\d{0,3}$/.test(raw)) {
    throw new RecallFeedError("SNOOZE_DEFAULT_HOURS is not a usable number of hours", "INTERNAL_CONFIG");
  }
  const hours = Number.parseInt(raw, 10);
  if (hours > MAX_SNOOZE_HOURS) {
    throw new RecallFeedError("SNOOZE_DEFAULT_HOURS is not a usable number of hours", "INTERNAL_CONFIG");
  }
  return hours;
}
