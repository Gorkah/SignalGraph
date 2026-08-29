"use client";

import { useBoardStore } from "@/lib/store";
import type { CaseNode } from "@/lib/types";
import { useNodeDrag } from "@/components/useNodeDrag";

/**
 * El punto central del tablón: la pregunta que abrió el caso. Todo lo demás
 * está en el corcho porque cuelga de aquí, y por eso es lo único clavado con
 * chincheta y lo único con la cabecera en rojo: tres marcas de rango contra
 * las dos de una ficha y la única de una pista.
 *
 * El relato completo vive fuera del corcho, en una columna legible. Aquí queda
 * solo la pregunta y, al aparecer una conexión, la respuesta comprobada.
 */
export function Caso({ focus, cards, edges }: { focus: CaseNode; cards: number; edges: number }) {
  const drag = useNodeDrag(focus.id, focus.position);
  const view = useBoardStore((state) => state.caseView);
  const started = useBoardStore((state) => state.storyStarted);
  const ui = view?.ui;

  return (
    <>
      <article
        className={`case-node nivel-caso ${focus.finding ? "has-finding" : ""}`}
        style={{ left: focus.position.x, top: focus.position.y }}
      >
        <span className="case-pin" aria-hidden="true" />
        <header className="card-drag" {...drag} title="Arrastrá para mover el caso">
          <span className="rango" aria-hidden="true" />
          <span>{focus.finding ? (ui?.caseFinding ?? "RESPUESTA PARCIAL") : (ui?.caseOpen ?? "LA PREGUNTA")}</span>
          <span className="rango" aria-hidden="true" />
        </header>
        <h2>{focus.title}</h2>
        {focus.finding
          ? <p className="case-finding">{focus.finding}</p>
          : <p className="case-answer">{view?.story?.answer.headline ?? "El tablero está abierto."}</p>}
        {started && <footer>
          <span>{cards} {ui?.cards ?? "ACTORES"}</span>
          <span>{edges} {ui?.connections ?? "CONEXIONES"}</span>
        </footer>}
      </article>
    </>
  );
}
