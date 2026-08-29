"use client";

import { useState } from "react";
import { LiveObject } from "@liveblocks/client";
import { Retrato } from "@/components/Retrato";
import { buildCover, teaser } from "@/lib/fields";
import { placeNota } from "@/lib/notePlacement";
import { relationNoun } from "@/lib/relations";
import { useBoardStore } from "@/lib/store";
import type { EntityCard } from "@/lib/types";
import { useNodeDrag } from "@/components/useNodeDrag";
import { useMutation, useMyPresence, useStorage } from "@/liveblocks.config";
import type { NotaPayload } from "@/liveblocks.config";

/** Sin manifiesto —o con uno viejo— la ficha sigue diciendo algo útil. */
const DEFAULT_COVER = [
  { label: "dinero", fields: ["funding"], fallback: "el archivo no da cifra" },
  { label: "dónde", fields: ["city", "location"], fallback: "sin sitio anotado" },
];

export function Ficha({ card }: { card: EntityCard }) {
  const selected = useBoardStore((state) => state.selectedId === card.id);
  const selectNode = useBoardStore((state) => state.selectNode);
  const pullRelation = useBoardStore((state) => state.pullRelation);
  const openCard = useBoardStore((state) => state.openCard);
  const busy = useBoardStore((state) => state.busy);
  const dedup = useBoardStore((state) => state.dedup[card.id]);
  const drag = useNodeDrag(card.id, card.position);
  const view = useBoardStore((state) => state.caseView);
  // Qué cara del expediente está mirando hacia arriba. Vive aquí y no en el
  // store porque hojear es leer, no un estado del caso: al recargar, todas
  // las fichas vuelven a estar por su portada.
  const [dorso, setDorso] = useState(false);
  // El cajón de los hilos: cerrado por defecto, porque una ficha se lee
  // antes de tirar de ella.
  const [hilos, setHilos] = useState(false);
  // Composer de nota compartida: mismo patrón que el cajón de hilos, pero
  // para clavar una lectura propia junto a la ficha.
  const [notaAbierta, setNotaAbierta] = useState(false);
  const [texto, setTexto] = useState("");
  const [myPresence] = useMyPresence();
  const notas = useStorage((root) => root.notas);
  const addNota = useMutation(({ storage }, payload: NotaPayload) => {
    storage.get("notas").push(new LiveObject(payload));
  }, []);

  function submitNota(event: React.FormEvent) {
    event.preventDefault();
    const value = texto.trim();
    if (!value) return;
    const graph = useBoardStore.getState().researchCase;
    if (!graph) return;
    const portfolioRelation = view?.openVerb.relation ?? "INVESTED_IN";
    addNota({
      id: crypto.randomUUID(),
      cardId: card.id,
      text: value,
      author: myPresence.name.trim() || "Anónimo",
      color: myPresence.color || "#e0c341",
      // Anillos crecientes desde la ficha hasta el primer hueco libre: ni
      // ficha, ni cartera cerrada, ni caso, ni otra nota ya clavada.
      position: placeNota(card.position, graph, portfolioRelation, notas ?? []),
      createdAt: Date.now(),
    });
    setTexto("");
    setNotaAbierta(false);
  }

  function onContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setNotaAbierta(true);
  }

  // Una pista es la misma ficha en su densidad mínima: retrato, nombre y tipo.
  // Se vuelve completa al abrirla, que es cuando se pide su introspección.
  if (card.density === "lead") {
    return (
      <article
        className={`lead-card nivel-pista ${selected ? "is-selected" : ""} ${notaAbierta ? "is-nota" : ""}`}
        style={{ left: card.position.x, top: card.position.y }}
        onClick={() => void openCard(card.id)}
        onContextMenu={onContextMenu}
        title="Clic derecho para clavar una nota"
        {...drag}
      >
        <Retrato entityType={card.entityType} name={card.name} size={28} />
        <div className="lead-id">
          <strong>{card.name}</strong>
          <small>pista · {card.entityType}</small>
        </div>
        <span className="rango" aria-hidden="true" />
        {dedup && <span className="dedup-badge">YA ESTABA</span>}
        <span className="lead-foot">{busy[`open:${card.id}`] ? "abriendo…" : "abrir ▸"}</span>

        {notaAbierta && (
          <form
            className="nota-composer"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitNota}
          >
            <span className="nota-composer-hint">Una duda, un dato a verificar, un recordatorio…</span>
            <textarea
              autoFocus
              placeholder={`p. ej.: "confirmar si ${card.name} también entró en la ronda de..."`}
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
            />
            <button type="submit" disabled={!texto.trim()}>clavar en el tablón</button>
          </form>
        )}
      </article>
    );
  }

  // La portada canta las tres cosas a la vez; el importe es cita textual del
  // archivo —"over €83 million"—, así que se imprime tal cual llega.
  // Los huecos de portada los decide el manifiesto del caso: para fondos
  // pueden ser sede y fundación; para fundadores, rol y empresa. El código
  // solo sabe que son tres y que uno puede venir vacío.
  const slots = (view?.cover?.length ? view.cover : DEFAULT_COVER).slice(0, 3);
  const { lines: cover, back: description } = buildCover(card.claims, slots, view?.back?.fields);

  return (
    <article
      className={`entity-card nivel-ficha ${selected ? "is-selected" : ""} ${dorso ? "is-dorso" : ""} ${hilos ? "is-hilos" : ""} ${notaAbierta ? "is-nota" : ""}`}
      style={{ left: card.position.x, top: card.position.y }}
      data-category={card.category}
      onClick={() => selectNode(card.id)}
      onContextMenu={onContextMenu}
      title="Clic derecho para clavar una nota"
    >
      <header className="card-drag" {...drag} title="Arrastrá para moverla · clic para abrir su carpeta">
        <Retrato entityType={card.entityType} name={card.name} size={38} />
        <span className="card-id">
          <strong>{card.name}</strong>
          <small>{card.category ?? card.entityType}</small>
        </span>
        <span className="card-mark">
          {dedup && <span className="dedup-badge">YA ESTABA</span>}
          <span className="rango" aria-hidden="true" />
        </span>
      </header>

      {/* La hoja: se pasa hacia atrás y enseña la descripción. Es su propio
          botón para no pisar ni el clic de la carpeta (el rótulo de arriba)
          ni el arrastre (que solo vive en la cabecera). */}
      <button
        type="button"
        className="card-leaf"
        aria-pressed={dorso}
        aria-label={dorso ? `Volver a la portada de ${card.name}` : `Pasar la hoja de ${card.name} y leer su descripción`}
        title={dorso ? "Volver a la portada" : "Pasar la hoja"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setDorso((value) => !value);
        }}
      >
        <span className="leaf leaf-portada">
          {cover.map(({ slot, claim }) => (
            <span className="leaf-line" key={slot.label}>
              <i>{slot.label}</i>
              {claim
                ? (
                  <b>
                    {teaser(claim.value)}
                    {claim.date && <time dateTime={claim.date}>{claim.date.slice(0, 7)}</time>}
                  </b>
                )
                : <b className="is-void">{slot.fallback}</b>}
            </span>
          ))}
        </span>

        <span className="leaf leaf-dorso">
          <i>al dorso</i>
          <b className={description ? undefined : "is-void"}>
            {description ? description.value : "el archivo no la describe"}
          </b>
        </span>

        <span className="leaf-tab" aria-hidden="true">{dorso ? "◂ portada" : "dorso ▸"}</span>
      </button>

      <footer>
        {card.relations.length ? (
          <button
            className="hilos-toggle"
            type="button"
            aria-expanded={hilos}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setHilos((open) => !open);
            }}
          >
            <span>{card.relations.length} {card.relations.length === 1 ? "hilo" : "hilos"}</span>
            <b>{hilos ? "cerrar ▴" : "tirar ▾"}</b>
          </button>
        ) : <span className="no-relations">sin hilos locales</span>}
      </footer>

      {notaAbierta && (
        <form
          className="nota-composer"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onSubmit={submitNota}
        >
          <span className="nota-composer-hint">Una duda, un dato a verificar, un recordatorio…</span>
          <textarea
            autoFocus
            placeholder={`p. ej.: "confirmar si ${card.name} también entró en la ronda de..."`}
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
          />
          <button type="submit" disabled={!texto.trim()}>clavar en el tablón</button>
        </form>
      )}

      {hilos && (
        <div className="hilos-drawer">
          {card.relations.map((relation) => (
            <button
              className="hilo-row"
              key={relation.type}
              type="button"
              disabled={busy[`${card.id}:${relation.type}`]}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                void pullRelation(card.id, relation.type).then(() => setHilos(false));
              }}
            >
              <span>{relationNoun(relation.type)}</span>
              <b>{relation.count ?? "·"}</b>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
