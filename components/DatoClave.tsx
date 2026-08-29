"use client";

import { useBoardStore } from "@/lib/store";

export function DatoClave() {
  const graph = useBoardStore((state) => state.researchCase);
  const fact = useBoardStore((state) => state.caseView?.story?.facts?.[0]);
  const started = useBoardStore((state) => state.storyStarted);
  if (!graph || !fact || !started) return null;

  return (
    <aside
      className="key-fact"
      style={{ left: graph.focus.position.x - 280, top: graph.focus.position.y + 8 }}
      title={fact.detail}
    >
      <span className="key-fact-pin" aria-hidden="true" />
      <small>DATO DE PARTIDA</small>
      {fact.value && <strong>{fact.value}</strong>}
      <p>{fact.label}</p>
      <footer>
        {fact.sourceUrl
          ? <a href={fact.sourceUrl} target="_blank" rel="noreferrer">{fact.sourceLabel}</a>
          : fact.sourceLabel}
        {fact.asOf ? ` · ${fact.asOf}` : ""}
      </footer>
    </aside>
  );
}
