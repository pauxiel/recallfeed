import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RecallFeedApiError, createRecallFeedClient } from "@recallfeed/client";
import type { PublicCard } from "@recallfeed/client";
import { Card } from "./Card";
import { apiBaseUrl } from "./config";

/** Cards per request. The API allows 1 to 50. */
const PAGE_SIZE = 10;

type Status = "loading" | "idle" | "done" | "error";

/**
 * The public feed: published cards, oldest-reviewed first, loaded a page at a time as the reader scrolls.
 *
 * It uses `@recallfeed/client` with no API key. Reading is anonymous, and the API returns only published
 * cards with only the public fields. A "Load more" button is the fallback when scrolling cannot trigger a
 * load (keyboard use, or a browser without IntersectionObserver).
 */
export function Feed(): ReactNode {
  const client = useMemo(() => createRecallFeedClient({ baseUrl: apiBaseUrl() }), []);
  const [cards, setCards] = useState<PublicCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorCode, setErrorCode] = useState("");
  const busy = useRef(false);
  const started = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (after: string | null): Promise<void> => {
      if (busy.current) return;
      busy.current = true;
      setStatus("loading");
      try {
        const page = await client.listFeed({ limit: PAGE_SIZE, ...(after === null ? {} : { cursor: after }) });
        setCards((previous) => [...previous, ...page.items]);
        setCursor(page.nextCursor);
        setStatus(page.nextCursor === null ? "done" : "idle");
      } catch (error) {
        setErrorCode(error instanceof RecallFeedApiError ? error.code : "CLIENT_ERROR");
        setStatus("error");
      } finally {
        busy.current = false;
      }
    },
    [client],
  );

  useEffect(() => {
    // StrictMode runs effects twice in development; the first load must happen once.
    if (started.current) return;
    started.current = true;
    void load(null);
  }, [load]);

  useEffect(() => {
    const target = sentinel.current;
    if (status !== "idle" || cursor === null || target === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load(cursor);
      },
      { rootMargin: "400px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [status, cursor, load]);

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
      {status === "loading" && <p className="font-mono text-sm text-ink-500">loading…</p>}
      {status === "done" && cards.length === 0 && <p className="text-ink-300">No published notes yet.</p>}
      {status === "done" && cards.length > 0 && <p className="font-mono text-sm text-ink-500">// end of feed</p>}
      {status === "error" && (
        <div role="alert" className="rounded-lg border border-amber/50 bg-ink-900 p-4 text-ink-300">
          <p>The feed could not be loaded. Try again in a moment.</p>
          <p className="mt-1 font-mono text-xs text-ink-500">{errorCode}</p>
          <button
            type="button"
            className="mt-3 rounded border border-ink-500 px-3 py-1.5 font-mono text-sm text-ink-100 hover:border-signal hover:text-signal"
            onClick={() => void load(cursor)}
          >
            Retry
          </button>
        </div>
      )}
      {status === "idle" && cursor !== null && (
        <div ref={sentinel}>
          <button
            type="button"
            className="rounded border border-ink-500 px-3 py-1.5 font-mono text-sm text-ink-100 hover:border-signal hover:text-signal"
            onClick={() => void load(cursor)}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
