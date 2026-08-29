"use client";

import { useState } from "react";
import { relationNoun } from "@/lib/relations";
import { downloadInvestigationPng } from "@/lib/share-png";
import { useBoardStore } from "@/lib/store";

export function Carpeta() {
  const graph = useBoardStore((state) => state.researchCase);
  const selectedId = useBoardStore((state) => state.selectedId);
  const selectNode = useBoardStore((state) => state.selectNode);
  const pullRelation = useBoardStore((state) => state.pullRelation);
  const setToast = useBoardStore((state) => state.setToast);
  const [checked, setChecked] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const card = graph?.cards.find((item) => item.id === selectedId);

  const selectableRelations = card?.relations.map((relation) => relation.type) ?? [];
  const validChecked = checked.filter((relation) => selectableRelations.includes(relation));
  const sources = card
    ? [...new Map(card.claims.map((claim) => [claim.source.file, claim.source])).values()]
    : [];

  if (!card) return null;

  async function shareCurrentNode() {
    if (!graph || !card || sharing) return;
    setSharing(true);
    try {
      const filename = await downloadInvestigationPng(graph, card.id);
      setToast(`PNG descargado · ${filename}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "No se pudo crear el PNG");
    } finally {
      setSharing(false);
    }
  }

  return (
    <aside className="folder" aria-label="Carpeta de entidad">
      <header>
        <div>
          <span>CARPETA</span>
          <h2>{card.name}</h2>
        </div>
        <div className="folder-actions">
          <button
            type="button"
            className="share-node"
            disabled={sharing}
            onClick={() => void shareCurrentNode()}
            title="Descargar el recorrido hasta esta ficha como PNG"
          >
            {sharing ? "…" : "PNG"}
          </button>
          <button type="button" onClick={() => selectNode(undefined)} aria-label="Cerrar carpeta">×</button>
        </div>
      </header>
      <>
          <section>
            <h3>Qué se sabe, y quién lo dice</h3>
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
            <h3>De dónde sale</h3>
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
              <h3>Seguir un hilo desde aquí</h3>
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
                    {relationNoun(relation.type)} <b>{relation.count}</b>
                  </label>
                ))}
              </div>
              <button
                className="primary-button"
                type="button"
                disabled={!validChecked.length}
                onClick={() => validChecked.slice(0, 2).forEach((relation) => void pullRelation(card.id, relation))}
              >
                traer al tablón
              </button>
            </section>
          )}
        </>
    </aside>
  );
}
