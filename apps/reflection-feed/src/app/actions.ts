"use server";

import { DEFAULT_SNOOZE_HOURS } from "@recallfeed/feed-engine";
import { revalidatePath } from "next/cache";
import { requestFeed } from "../feed";

/**
 * Marks one card reviewed, then refreshes the feed.
 *
 * The Worker wrapper has already verified the Access token and the owner before this runs. This repeats
 * the owner check so the action fails closed if it is ever reached another way. Next.js refuses a
 * Server Action whose Origin does not match the host, which covers cross-site requests.
 *
 * @param formData - The submitted form: `id` is the card's ID.
 */
export async function markReviewed(formData: FormData): Promise<void> {
  const { env, ownerEmail, engine } = await requestFeed();
  const owner = env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  if (owner === "" || ownerEmail?.trim().toLowerCase() !== owner) {
    throw new Error("Unauthorized");
  }
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    throw new Error("Invalid request");
  }
  await engine.recordReview(id, "reviewed", { snoozeHours: DEFAULT_SNOOZE_HOURS });
  revalidatePath("/");
}
