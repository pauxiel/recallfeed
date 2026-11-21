import type { ReactNode } from "react";
import { requestFeed } from "../feed";
import { markReviewed } from "./actions";

// Every request reads the owner's live feed; nothing is prerendered or cached.
export const dynamic = "force-dynamic";

/**
 * The feed: the owner's first page of cards, read on the server straight from the shared feed engine
 * (no HTTP call to the API). The Worker wrapper has already verified the owner; the identity shown here
 * is the one it handed on.
 */
export default async function FeedPage(): Promise<ReactNode> {
  const { env, ownerEmail, engine } = await requestFeed();
  const strategy = env.DEFAULT_RESURFACING_STRATEGY?.trim() || undefined;
  const page = await engine.listFeedItems({ isPublicRequest: false, limit: 10, ...(strategy ? { strategy } : {}) });

  return (
    <main>
      <h1>ReflectionFeed</h1>
      <p>Signed in as {ownerEmail ?? "unknown"}.</p>
      {page.items.length === 0 ? (
        <p>No cards yet. Import some notes to start.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {page.items.map((item) => (
            <li key={item.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
              <small>
                {item.cardType} · reviewed {item.reviewCount} times
              </small>
              <p style={{ whiteSpace: "pre-wrap" }}>{item.content}</p>
              <form action={markReviewed}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit">Mark reviewed</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
