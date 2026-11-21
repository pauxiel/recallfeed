import type { ReactNode } from "react";
import type { PublicCard } from "@recallfeed/client";
import { splitBlocks, splitInline } from "./content";
import type { Leaf } from "./content";

const LABELS: Record<string, string> = {
  original: "note",
  highlight: "highlight",
  summary: "summary",
  code_snippet: "snippet",
  reflection_prompt: "prompt",
};

function Leaves({ runs }: { runs: Leaf[] }): ReactNode {
  return runs.map((run, index) =>
    run.kind === "code" ? (
      <code key={index} className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[0.9em] text-signal">{run.text}</code>
    ) : (
      run.text
    ),
  );
}

function Inline({ text }: { text: string }): ReactNode {
  return splitInline(text).map((run, index) =>
    run.kind === "bold" ? (
      <strong key={index} className="font-semibold text-ink-100">
        <Leaves runs={run.runs} />
      </strong>
    ) : (
      <Leaves key={index} runs={[run]} />
    ),
  );
}

/**
 * One public card. The content is rendered through React's text nodes only, so nothing in a note can
 * inject markup. A public card carries no review data, so none is shown.
 */
export function Card({ card }: { card: PublicCard }): ReactNode {
  const blocks = splitBlocks(card.content);
  return (
    <article className="rounded-lg border border-ink-700 bg-ink-900 p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-xs text-ink-500">
        <span className="rounded bg-signal-dim/40 px-2 py-0.5 text-signal">{LABELS[card.cardType] ?? card.cardType}</span>
        <time dateTime={card.createdAt}>{card.createdAt.slice(0, 10)}</time>
      </div>
      <div className="space-y-3 leading-relaxed text-ink-300">
        {blocks.map((block, index) =>
          block.kind === "code" ? (
            <pre key={index} className="overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-4 font-mono text-sm text-ink-100">
              {block.language !== "" && <span className="mb-2 block text-xs text-amber">{block.language}</span>}
              <code>{block.code}</code>
            </pre>
          ) : (
            <p key={index} className="whitespace-pre-line">
              <Inline text={block.text} />
            </p>
          ),
        )}
      </div>
    </article>
  );
}
