"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Cartera } from "@/components/Cartera";
import { Caso } from "@/components/Caso";
import { Ficha } from "@/components/Ficha";
import { Mazo, RecogerMazo } from "@/components/Mazo";
import { Hilos } from "@/components/Hilos";
import { CARD_HEIGHT, CARD_WIDTH, GRID_SIZE, LEAD_WIDTH, STACK_HEIGHT, portfolioPosition } from "@/lib/geometry";
import { MAX_ZOOM, MIN_ZOOM, useBoardStore } from "@/lib/store";
import type { Point } from "@/lib/types";

const ZOOM_STEP = 1.25;

// La rejilla no es decoración: es el encaje real de las fichas (GRID_SIZE px
// de tablón). Por eso los tres niveles son múltiplos suyos y cualquier línea
// que se vea cae siempre sobre una posición válida de encaje.
const GRID_LEVELS = [
  { units: 1, rgb: "32 27 24", ink: 0.19 },   // 16px: el paso de encaje
  { units: 4, rgb: "255 248 223", ink: 0.26 }, // 64px: el relieve de siempre
  { units: 16, rgb: "32 27 24", ink: 0.18 },  // 256px: la retícula grande
];

/**
 * Cuánto pesa un nivel según lo apretado que se vea EN PANTALLA. Por debajo de
 * ~6px se apaga (sería una masa de líneas) y a partir de ~20px va a tope. Como
 * cada nivel decide por su cuenta y se acumulan por transparencia, el cambio es
 * continuo: al alejar, el paso de 16px se desvanece antes de emborronarse y el
 * de 64 ocupa su sitio sin ningún salto.
 */
function densidad(pasoEnPantalla: number) {
  return Math.min(1, Math.max(0, (pasoEnPantalla - 6) / 14));
}

/**
 * La rejilla se pinta en coordenadas de pantalla: el tamaño de celda es el paso
 * del tablón por el zoom y el origen es el propio `pan`. Al repetirse el fondo,
 * cubre el viewport entero llegue donde llegue el desplazamiento.
 */
function estiloRejilla(pan: Point, zoom: number): CSSProperties {
  const capas: string[] = [];
  const tamanos: string[] = [];
  for (const nivel of GRID_LEVELS) {
    const paso = GRID_SIZE * nivel.units * zoom;
    const alfa = nivel.ink * densidad(paso);
    if (alfa < 0.004) continue;
    const color = `rgb(${nivel.rgb} / ${alfa.toFixed(3)})`;
    capas.push(`linear-gradient(${color} 1px, transparent 1px)`);
    capas.push(`linear-gradient(90deg, ${color} 1px, transparent 1px)`);
    tamanos.push(`${paso}px ${paso}px`, `${paso}px ${paso}px`);
  }
  return {
    backgroundImage: capas.join(", "),
    backgroundSize: tamanos.join(", "),
    backgroundPosition: `${pan.x}px ${pan.y}px`,
  };
}

export function Tablon() {
  const graph = useBoardStore((state) => state.researchCase);
  const pan = useBoardStore((state) => state.pan);
  const zoom = useBoardStore((state) => state.zoom);
  const setPan = useBoardStore((state) => state.setPan);
  const setZoom = useBoardStore((state) => state.setZoom);
  const setView = useBoardStore((state) => state.setView);
  const expandedStacks = useBoardStore((state) => state.expandedStacks);
  const viewport = useRef<HTMLElement | null>(null);
  const dragging = useRef<{ id: number; x: number; y: number; originX: number; originY: number } | null>(null);

  // Encaja todo el caso en el viewport: el tablón debe leerse entero
  // de un vistazo antes de que nadie toque nada.
  const fitToContent = useCallback(() => {
    const node = viewport.current;
    const current = useBoardStore.getState().researchCase;
    if (!node || !current) return;
    const boxes = [
      { ...current.focus.position, w: 296, h: 184 },
      ...current.cards.map((card) => card.density === "lead"
        ? { ...card.position, w: LEAD_WIDTH, h: 96 }
        : { ...card.position, w: CARD_WIDTH, h: CARD_HEIGHT }),
      ...current.cards
        .filter((card) => card.density === "full" && !card.parentId)
        .map((card) => ({
          ...portfolioPosition(
            { x: card.position.x + CARD_WIDTH / 2, y: card.position.y + CARD_HEIGHT / 2 },
            current.focus.position,
          ),
          w: LEAD_WIDTH,
          h: STACK_HEIGHT,
        })),
    ];
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const pad = 44;
    const gutterLeft = pad;
    const availableW = node.clientWidth - gutterLeft - pad;
    const availableH = node.clientHeight - pad * 2;
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(availableW / (maxX - minX), availableH / (maxY - minY))),
    );
    setView({
      zoom,
      pan: {
        x: gutterLeft + (availableW - (maxX - minX) * zoom) / 2 - minX * zoom,
        y: pad + (availableH - (maxY - minY) * zoom) / 2 - minY * zoom,
      },
    });
  }, [setView]);

  // Al abrir un caso nuevo, encuadre automático una sola vez.
  useEffect(() => {
    if (!graph || useBoardStore.getState().framedCaseId === graph.id) return;
    fitToContent();
    useBoardStore.setState({ framedCaseId: graph.id });
  }, [fitToContent, graph]);

  // Rueda = zoom anclado al cursor. Va en un listener no pasivo porque
  // hay que impedir el scroll de la página.
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = node!.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const factor = Math.exp(-event.deltaY * 0.0015);
      setZoom(useBoardStore.getState().zoom * factor, anchor);
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLElement && target.matches("input, textarea, [contenteditable=true]")) return;
      const centre = viewport.current
        ? { x: viewport.current.clientWidth / 2, y: viewport.current.clientHeight / 2 }
        : undefined;
      if (event.key === "+" || event.key === "=") setZoom(useBoardStore.getState().zoom * ZOOM_STEP, centre);
      if (event.key === "-" || event.key === "_") setZoom(useBoardStore.getState().zoom / ZOOM_STEP, centre);
      if (event.key === "0") fitToContent();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitToContent, setZoom]);

  if (!graph) return null;

  // Las pistas de un mismo tirón viajan juntas hasta que se abre el mazo; al
  // abrir una pista concreta pasa a ficha y sale del mazo por su cuenta.
  const stacks = new Map<string, typeof graph.cards>();
  const openGroups = new Map<string, typeof graph.cards>();
  const loose: typeof graph.cards = [];
  for (const card of graph.cards) {
    if (card.stackId && card.density === "lead") {
      const target = expandedStacks.includes(card.stackId) ? openGroups : stacks;
      const group = target.get(card.stackId) ?? [];
      group.push(card);
      target.set(card.stackId, group);
      if (expandedStacks.includes(card.stackId)) loose.push(card);
    } else {
      loose.push(card);
    }
  }
  const cardName = new Map(graph.cards.map((card) => [card.id, card.name]));

  // Un fondo enseña su cartera cerrada mientras no se haya tirado de ella.
  const pulled = new Set(graph.cards.map((card) => card.stackId).filter(Boolean));
  const carteras = graph.cards.filter(
    (card) => card.density === "full" && !card.parentId && !pulled.has(`${card.id}:INVESTED_IN`),
  );

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.button !== 0) return;
    dragging.current = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const active = dragging.current;
    if (!active || active.id !== event.pointerId) return;
    setPan({ x: active.originX + event.clientX - active.x, y: active.originY + event.clientY - active.y });
  }

  function stopPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragging.current?.id !== event.pointerId) return;
    dragging.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function step(factor: number) {
    const node = viewport.current;
    const centre = node ? { x: node.clientWidth / 2, y: node.clientHeight / 2 } : undefined;
    setZoom(useBoardStore.getState().zoom * factor, centre);
  }

  return (
    <section className="board-viewport" aria-label="Tablón de investigación" ref={viewport}>
      {/* La mesa de trabajo: rejilla sin final y zona de arrastre del tablón. */}
      <div
        className="board-grid"
        aria-hidden
        style={estiloRejilla(pan, zoom)}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
      />

      <div
        className="board-surface"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
      >
        <Hilos graph={graph} />
        <Caso focus={graph.focus} cards={graph.cards.length} edges={graph.edges.length} />
        {loose.map((card) => <Ficha key={card.id} card={card} />)}
        {carteras.map((card) => <Cartera key={`cartera-${card.id}`} card={card} focus={graph.focus} />)}
        {[...stacks].map(([stackId, group]) => (
          <Mazo key={stackId} cards={group} parentName={group[0].parentId ? cardName.get(group[0].parentId) : undefined} />
        ))}
        {[...openGroups].map(([stackId, group]) => (
          <RecogerMazo
            key={stackId}
            stackId={stackId}
            x={Math.min(...group.map((card) => card.position.x))}
            y={Math.min(...group.map((card) => card.position.y)) - 38}
          />
        ))}
      </div>

      <div className="zoom-dock" role="group" aria-label="Zoom del tablón">
        <button type="button" onClick={() => step(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Acercar">+</button>
        <output aria-label="Nivel de zoom">{Math.round(zoom * 100)}%</output>
        <button type="button" onClick={() => step(1 / ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Alejar">−</button>
        <button type="button" className="zoom-reset" onClick={fitToContent} aria-label="Encajar el caso">◱</button>
      </div>

      <div className="board-help">
        <i>inversión</i>
        <i className="is-case">procedencia (hover en el caso)</i>
        <span className="sep">·</span>
        <span>RUEDA = ZOOM · +/−/0</span>
      </div>
    </section>
  );
}
