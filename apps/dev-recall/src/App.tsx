import type { ReactNode } from "react";
import { Feed } from "./Feed";

/** The page: a header, the public feed, and a footer. There is no sign-in and no write control. */
export function App(): ReactNode {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10">
      <header className="mb-10 border-b border-ink-700 pb-6">
        <h1 className="font-mono text-3xl font-semibold tracking-tight">
          <span className="text-signal">&gt;</span> DevRecall
        </h1>
        <p className="mt-2 text-ink-300">
          Programming notes, code snippets and architecture decisions, resurfaced oldest first so they stick.
        </p>
      </header>
      <main className="flex-1" aria-live="polite">
        <Feed />
      </main>
      <footer className="mt-12 border-t border-ink-700 pt-5 font-mono text-xs text-ink-500">
        A public, read-only feed. Built on the RecallFeed skeleton.
      </footer>
    </div>
  );
}
