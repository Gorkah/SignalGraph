"use client";

import { useState, type CSSProperties } from "react";
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

/**
 * Cuántos cabos cuelgan sueltos antes de que el resto espere agrupado en el
 * manojo del final. Cuatro bastan para decidir sin convertir la ficha en un
 * menú técnico; el resto queda agrupado y sigue accesible.
 */
const CABOS_SUELTOS = 4;

/**
 * Cuánto se corre cada etiqueta respecto al canto izquierdo de la ficha. El
 * ciclo no es un adorno: sin él la ristra vuelve a caer en columna recta y a
 * leerse como la lista de la que se la quiere sacar.
 */
const SANGRADO = [0, 18, 6, 26, 12];

/**
 * Un cabo de la ristra: el cordel que lo ata al de arriba y la etiqueta de
 * cartón que cuelga de él. La etiqueta mide lo que dice, así que no hay dos
 * del mismo ancho y la ristra baja con el filo roto.
 */
function Cabo({ index, caida, nombre, cuenta, clase, tirando, desplegado, onTirar }: {
  index: number;
  caida: number;
  nombre: string;
  cuenta: string | number;
  clase?: string;
  tirando?: boolean;
  desplegado?: boolean;
  onTirar: () => void;
}) {
  return (
    <div
      className={`cabo ${clase ?? ""}`}
      style={{ "--x": `${SANGRADO[index % SANGRADO.length]}px`, "--i": String(caida) } as CSSProperties}
    >
      <span className="cabo-cuerda" aria-hidden="true" />
      <button
        className="cabo-etiqueta"
        type="button"
        disabled={tirando}
        aria-expanded={desplegado}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onTirar();
        }}
      >
        <span>{nombre}</span>
        <b>{tirando ? "…" : cuenta}</b>
      </button>
    </div>
  );
}

/** Sin manifiesto —o con uno viejo— la ficha sigue diciendo algo útil. */
const DEFAULT_COVER = [
  { label: "dinero", fields: ["funding"], fallback: "Cala no da una cifra" },
  { label: "dónde", fields: ["city", "location"], fallback: "sin sitio anotado" },
];

export function Ficha({ card, entranceIndex = 0 }: { card: EntityCard; entranceIndex?: number }) {
  const selected = useBoardStore((state) => state.selectedId === card.id);
  const selectNode = useBoardStore((state) => state.selectNode);
  const pullRelation = useBoardStore((state) => state.pullRelation);
  const openCard = useBoardStore((state) => state.openCard);
  const busy = useBoardStore((state) => state.busy);
  const dedup = useBoardStore((state) => state.dedup[card.id]);
  const drag = useNodeDrag(card.id, card.position);
  const view = useBoardStore((state) => state.caseView);
  const ui = view?.ui;
  const finding = useBoardStore((state) => state.researchCase?.focus.finding);
  const recommendedRelation = view?.story?.action.relationType;
  const storyTarget = !finding && view?.story?.action.entityId === card.id;
  // Qué cara del expediente está mirando hacia arriba. Vive aquí y no en el
  // store porque hojear es leer, no un estado del caso: al recargar, todas
  // las fichas vuelven a estar por su portada.
  const [dorso, setDorso] = useState(false);
  // La ristra de cabos: recogida por defecto, porque una ficha se lee antes
  // de tirar de ella. Y el manojo del final, atado, con los cabos finos que
  // no cuelgan sueltos. Los dos viven aquí y no en el store: hojear es leer.
  const [hilos, setHilos] = useState(false);
  const [manojo, setManojo] = useState(false);
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
        style={{ left: card.position.x, top: card.position.y, "--enter": `${entranceIndex * 70}ms` } as CSSProperties}
        onClick={() => void openCard(card.id)}
        onContextMenu={onContextMenu}
        title="Clic derecho para clavar una nota"
        {...drag}
      >
        <Retrato entityType={card.entityType} name={card.name} size={28} />
        <div className="lead-id">
          <strong>{card.name}</strong>
          <small>{ui?.lead ?? "resultado"} · {card.entityType}</small>
        </div>
        <span className="rango" aria-hidden="true" />
        {dedup && <span className="dedup-badge">{ui?.foundConnection ?? "CONEXIÓN ENCONTRADA"}</span>}
        <span className="lead-foot">{busy[`open:${card.id}`] ? "abriendo…" : `${ui?.openLead ?? "ver"} ▸`}</span>

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

  // Los cabos gruesos cuelgan sueltos; los que sobran esperan en el manojo.
  const cabos = recommendedRelation
    ? [...card.relations].sort((a, b) => Number(b.type === recommendedRelation) - Number(a.type === recommendedRelation))
    : card.relations;
  const agrupa = cabos.length > CABOS_SUELTOS + 1;
  const colgados = agrupa && !manojo ? cabos.slice(0, CABOS_SUELTOS) : cabos;

  // El escalonado de la caída se cuenta desde el primero de cada tanda: al
  // soltar el manojo sus cabos caen ya, y no detrás del retraso de los ocho
  // que llevan rato colgando.
  const caida = (index: number) => (index < CABOS_SUELTOS ? index : index - CABOS_SUELTOS);

  // Recoger la ristra la deja como estaba: el manojo se vuelve a atar, porque
  // cada vuelta a la ficha empieza otra vez por los cabos gruesos.
  function recoger() {
    setHilos(false);
    setManojo(false);
  }

  return (
    <article
      className={`entity-card nivel-ficha ${selected ? "is-selected" : ""} ${dorso ? "is-dorso" : ""} ${hilos ? "is-hilos" : ""} ${storyTarget ? "is-story-target" : ""} ${notaAbierta ? "is-nota" : ""}`}
      style={{ left: card.position.x, top: card.position.y, "--enter": `${entranceIndex * 70}ms` } as CSSProperties}
      data-category={card.category}
      onClick={() => selectNode(card.id)}
      onContextMenu={onContextMenu}
      title="Clic derecho para clavar una nota"
    >
      {card.tag && <span className="role-tag" data-tone={card.tagTone ?? "yellow"}>{card.tag}</span>}
      {storyTarget && !hilos && (
        <button
          type="button"
          className="story-card-hint"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setHilos(true);
          }}
        >
          <small>EMPIEZA AQUÍ</small>
          <span>{view?.story?.action.label}</span>
        </button>
      )}
      <header className="card-drag" {...drag} title="Arrastrá para moverla · clic para abrir su carpeta">
        <Retrato entityType={card.entityType} name={card.name} size={38} />
        <span className="card-id">
          <strong>{card.name}</strong>
          <small>{card.category ?? card.entityType}</small>
        </span>
        <span className="card-mark">
          {dedup && <span className="dedup-badge">{ui?.foundConnection ?? "CONEXIÓN ENCONTRADA"}</span>}
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
        title={dorso ? (ui?.front ?? "Volver") : (ui?.details ?? "Ver detalles")}
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
          <i>{ui?.details ?? "detalles"}</i>
          <b className={description ? undefined : "is-void"}>
            {description ? description.value : "Cala no la describe"}
          </b>
        </span>

        <span className="leaf-tab" aria-hidden="true">{dorso ? `◂ ${ui?.front ?? "volver"}` : `${ui?.details ?? "detalles"} ▸`}</span>
      </button>

      <footer>
        {cabos.length ? (
          <button
            className="cabos-toggle"
            type="button"
            aria-expanded={hilos}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (hilos) recoger();
              else setHilos(true);
            }}
          >
            <i>{cabos.length}</i>
            <span>{cabos.length === 1 ? (ui?.connection ?? "conexión") : (ui?.connections ?? "conexiones")}</span>
            <b>{hilos ? (ui?.hideConnections ?? "ocultar ▴") : (ui?.showConnections ?? "ver ▾")}</b>
          </button>
        ) : <span className="no-relations">{ui?.noConnections ?? "sin conexiones disponibles"}</span>}
      </footer>

      {/* Recogida, la ficha deja el fleco a la vista: un cordel por tipo de
          relación, que se cuentan sin abrir nada. Cuelga por fuera del borde
          de abajo, así que no tapa ni la portada ni el pie. */}
      {cabos.length > 0 && !hilos && (
        <span className="cabo-fleco" aria-hidden="true">
          {cabos.slice(0, 12).map((relation) => <i key={relation.type} />)}
        </span>
      )}

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
        <div className="cabos-ristra">
          {colgados.map((relation, index) => (
            <Cabo
              key={relation.type}
              index={index}
              caida={caida(index)}
              clase={relation.type === recommendedRelation ? "is-recommended" : undefined}
              nombre={relationNoun(relation.type)}
              cuenta={relation.count ?? "·"}
              tirando={busy[`${card.id}:${relation.type}`]}
              onTirar={() => void pullRelation(card.id, relation.type).then(recoger)}
            />
          ))}
          {agrupa && (
            <Cabo
              index={colgados.length}
              caida={caida(colgados.length)}
              clase="is-manojo"
              nombre={manojo
                ? (ui?.collectConnections ?? "ocultar conexiones")
                : `${ui?.moreConnections ?? "más conexiones"}: ${cabos.length - CABOS_SUELTOS}`}
              cuenta={manojo ? "▴" : "▾"}
              desplegado={manojo}
              onTirar={() => setManojo((value) => !value)}
            />
          )}
        </div>
      )}
    </article>
  );
}
