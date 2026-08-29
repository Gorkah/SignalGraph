"use client";

import type { CaseNode } from "@/lib/types";
import { useNodeDrag } from "@/components/useNodeDrag";

/**
 * El punto central del tablón: la pregunta que abrió el caso. Todo lo demás
 * está en el corcho porque cuelga de aquí.
 */
export function Caso({ focus, cards, edges }: { focus: CaseNode; cards: number; edges: number }) {
  const drag = useNodeDrag(focus.id, focus.position);
  return (
    <article
      className={`case-node ${focus.finding ? "has-finding" : ""}`}
      style={{ left: focus.position.x, top: focus.position.y }}
    >
      <header className="card-drag" {...drag}>
        <span>{focus.finding ? "CASO · HALLAZGO" : "CASO ABIERTO"}</span>
      </header>
      <h2>{focus.title}</h2>
      {focus.finding
        ? <p className="case-finding">{focus.finding}</p>
        : <code>{focus.query}</code>}
      <footer>
        <span>{cards} FICHAS</span>
        <span>{edges} HILOS</span>
      </footer>
    </article>
  );
}
