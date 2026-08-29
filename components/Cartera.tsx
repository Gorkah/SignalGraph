"use client";

import { CARD_HEIGHT, CARD_WIDTH, portfolioPosition } from "@/lib/geometry";
import { relationNoun } from "@/lib/relations";
import { useBoardStore } from "@/lib/store";
import type { CaseNode, EntityCard } from "@/lib/types";

/**
 * La cartera cerrada de un fondo: promesa, no contenido. Si las carteras
 * vinieran ya tiradas en la semilla, la participada compartida existiría en
 * dos a la vez desde el arranque y no habría reencuentro que descubrir.
 * Abrirla es lo que tira del hilo.
 */
export function Cartera({ card, focus }: { card: EntityCard; focus: CaseNode }) {
  const pullRelation = useBoardStore((state) => state.pullRelation);
  const view = useBoardStore((state) => state.caseView);
  const PORTFOLIO = view?.openVerb.relation ?? "INVESTED_IN";
  const busy = useBoardStore((state) => state.busy[`${card.id}:${PORTFOLIO}`]);
  // Si no hay conteo local la cartera se muestra igual: abrirla saldrá en vivo.
  const relation = card.relations.find((item) => item.type === PORTFOLIO);

  const position = portfolioPosition(
    { x: card.position.x + CARD_WIDTH / 2, y: card.position.y + CARD_HEIGHT / 2 },
    focus.position,
  );

  return (
    <article
      className="lead-stack is-closed"
      style={{ left: position.x, top: position.y }}
      onClick={() => void pullRelation(card.id, PORTFOLIO)}
    >
      <span className="stack-sheet stack-sheet-3" aria-hidden="true" />
      <span className="stack-sheet stack-sheet-2" aria-hidden="true" />
      <div className="stack-top">
        <b className="stack-count">{relation?.count ?? "·"}</b>
        <div className="stack-body">
          <strong>{view?.openVerb.label ?? "cartera"}</strong>
          <small>{view?.openVerb.noun ?? relationNoun(PORTFOLIO)} de {card.name}</small>
        </div>
      </div>
      <footer>{busy ? "abriendo…" : `abrir · ${view?.openVerb.label ?? "cartera"} ▾`}</footer>
    </article>
  );
}
