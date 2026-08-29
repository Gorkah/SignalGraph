"use client";

import { visibleClaim } from "@/lib/fields";
import { useBoardStore } from "@/lib/store";
import type { EntityCard } from "@/lib/types";
import { useNodeDrag } from "@/components/useNodeDrag";

export function Ficha({ card }: { card: EntityCard }) {
  const selector = useBoardStore((state) => state.selector);
  const selected = useBoardStore((state) => state.selectedId === card.id);
  const selectNode = useBoardStore((state) => state.selectNode);
  const pullRelation = useBoardStore((state) => state.pullRelation);
  const busy = useBoardStore((state) => state.busy);
  const dedup = useBoardStore((state) => state.dedup[card.id]);
  const drag = useNodeDrag(card.id, card.position);
  const claim = visibleClaim(card, selector);
  // Con relaciones reales una ficha puede traer 6 tipos; el corcho solo
  // aguanta los tres más gruesos sin dejar de ser legible.
  const stubs = card.relations.slice(0, 3);
  const hidden = card.relations.length - stubs.length;

  return (
    <article
      className={`entity-card ${selected ? "is-selected" : ""}`}
      style={{ left: card.position.x, top: card.position.y }}
      data-category={card.category}
      onClick={() => selectNode(card.id)}
    >
      <header className="card-drag" {...drag}>
        <span className="card-index">{card.entityType.slice(0, 3).toUpperCase()}</span>
        <strong>{card.name}</strong>
        {dedup && <span className="dedup-badge">YA ESTABA</span>}
      </header>
      <div className="card-category">{card.category ?? card.entityType}</div>
      <p className="visible-claim">
        {claim ? claim.value : "Sin dato para este selector"}
        {claim?.date && <time dateTime={claim.date}>{claim.date.slice(0, 7)}</time>}
      </p>
      <footer>
        {stubs.length ? stubs.map((relation) => (
          <button
            className="relation-stub"
            key={relation.type}
            type="button"
            disabled={busy[`${card.id}:${relation.type}`]}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              void pullRelation(card.id, relation.type);
            }}
          >
            <span>{relation.type}</span>
            <b>{relation.count}</b>
          </button>
        )) : <span className="no-relations">sin cabos locales</span>}
        {hidden > 0 && <span className="more-relations">+{hidden}</span>}
      </footer>
    </article>
  );
}
