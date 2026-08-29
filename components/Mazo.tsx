"use client";

import { Retrato } from "@/components/Retrato";
import { relationNoun } from "@/lib/relations";
import { useBoardStore } from "@/lib/store";
import { useNodeDrag } from "@/components/useNodeDrag";
import type { EntityCard } from "@/lib/types";

/**
 * Un tirón trae varias pistas a la vez. Sueltas inundan el corcho, así que
 * llegan apiladas: el mazo es una sola cosa que dice de dónde sale y cuántas
 * trae, y se despliega cuando te interesa mirarlas.
 */
export function Mazo({ cards, parentName }: { cards: EntityCard[]; parentName?: string }) {
  const toggleStack = useBoardStore((state) => state.toggleStack);
  const top = cards[0];
  const drag = useNodeDrag(top.id, top.position);
  const noun = top.relationType ? relationNoun(top.relationType) : "pistas";

  return (
    <article
      className="lead-stack"
      style={{ left: top.position.x, top: top.position.y }}
      onClick={() => top.stackId && toggleStack(top.stackId)}
    >
      <span className="stack-sheet stack-sheet-3" aria-hidden="true" />
      <span className="stack-sheet stack-sheet-2" aria-hidden="true" />
      <div className="stack-top" {...drag}>
        <b className="stack-count">{cards.length}</b>
        <div className="stack-body">
          <strong>{noun}</strong>
          {parentName && <small>de {parentName}</small>}
        </div>
        <div className="stack-faces" aria-hidden="true">
          {cards.slice(0, 3).map((card) => (
            <Retrato key={card.id} entityType={card.entityType} name={card.name} size={22} />
          ))}
        </div>
      </div>
      <footer>desplegar ▾</footer>
    </article>
  );
}

/** Devuelve el mazo a su sitio: sin esto, abrirlo era irreversible. */
export function RecogerMazo({ stackId, x, y }: { stackId: string; x: number; y: number }) {
  const toggleStack = useBoardStore((state) => state.toggleStack);
  return (
    <button type="button" className="stack-collapse" style={{ left: x, top: y }} onClick={() => toggleStack(stackId)}>
      ▴ recoger el mazo
    </button>
  );
}
