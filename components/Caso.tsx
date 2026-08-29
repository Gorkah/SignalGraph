"use client";

import type { CaseNode } from "@/lib/types";
import { useNodeDrag } from "@/components/useNodeDrag";

/**
 * El punto central del tablón: la pregunta que abrió el caso. Todo lo demás
 * está en el corcho porque cuelga de aquí, y por eso es lo único clavado con
 * chincheta y lo único con la cabecera en rojo: tres marcas de rango contra
 * las dos de una ficha y la única de una pista.
 */
export function Caso({ focus, cards, edges }: { focus: CaseNode; cards: number; edges: number }) {
  const drag = useNodeDrag(focus.id, focus.position);
  return (
    <article
      className={`case-node nivel-caso ${focus.finding ? "has-finding" : ""}`}
      style={{ left: focus.position.x, top: focus.position.y }}
    >
      <span className="case-pin" aria-hidden="true" />
      <header className="card-drag" {...drag} title="Arrastrá para mover el caso">
        <span className="rango" aria-hidden="true" />
        <span>{focus.finding ? "CASO · HALLAZGO" : "CASO ABIERTO"}</span>
        <span className="rango" aria-hidden="true" />
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
