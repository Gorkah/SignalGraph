"use client";

import { useState } from "react";
import { useBoardStore } from "@/lib/store";

export function Carpeta() {
  const graph = useBoardStore((state) => state.researchCase);
  const selectedId = useBoardStore((state) => state.selectedId);
  const selectNode = useBoardStore((state) => state.selectNode);
  const pullRelation = useBoardStore((state) => state.pullRelation);
  const [checked, setChecked] = useState<string[]>([]);
  const card = graph?.cards.find((item) => item.id === selectedId);
  const pin = graph?.pins.find((item) => item.id === selectedId);

  const selectableRelations = card?.relations.map((relation) => relation.type) ?? [];
  const validChecked = checked.filter((relation) => selectableRelations.includes(relation));
  const sources = card
    ? [...new Map(card.claims.map((claim) => [claim.source.file, claim.source])).values()]
    : [];

  if (!card && !pin) return null;

  return (
    <aside className="folder" aria-label="Carpeta de entidad">
      <header>
        <div>
          <span>CARPETA / {card ? "FICHA" : "CHINCHETA"}</span>
          <h2>{card?.name ?? pin?.name}</h2>
        </div>
        <button type="button" onClick={() => selectNode(undefined)} aria-label="Cerrar carpeta">×</button>
      </header>
      {card ? (
        <>
          <section>
            <h3>Campos con procedencia</h3>
            <dl className="claim-list">
              {card.claims.map((claim, index) => (
                <div key={`${claim.key}-${index}`}>
                  <dt>{claim.label}</dt>
                  <dd>{claim.value}</dd>
                  <small>
                    {claim.date ? `${claim.date} · ` : ""}{claim.source.query}
                  </small>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>Fuentes</h3>
            <ul className="source-list">
              {sources.map((source) => (
                <li key={source.file}>
                  {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}
                  <small>{source.file}<br />{new Date(source.runAt).toLocaleString("es-ES")}</small>
                </li>
              ))}
            </ul>
          </section>
          {card.relations.length > 0 && (
            <section>
              <h3>Reclutar relaciones</h3>
              <div className="relation-checklist">
                {card.relations.map((relation) => (
                  <label key={relation.type}>
                    <input
                      type="checkbox"
                      checked={validChecked.includes(relation.type)}
                      onChange={(event) => setChecked((current) => event.target.checked
                        ? [...current, relation.type]
                        : current.filter((item) => item !== relation.type))}
                    />
                    {relation.type} <b>{relation.count}</b>
                  </label>
                ))}
              </div>
              <button
                className="primary-button"
                type="button"
                disabled={!validChecked.length}
                onClick={() => validChecked.slice(0, 2).forEach((relation) => void pullRelation(card.id, relation))}
              >
                subir al tablón
              </button>
            </section>
          )}
        </>
      ) : (
        <p className="folder-empty">Ascendé la chincheta desde su etiqueta para cargar la introspección.</p>
      )}
    </aside>
  );
}
