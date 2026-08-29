"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Caso } from "@/components/Caso";
import { Chincheta } from "@/components/Chincheta";
import { Ficha } from "@/components/Ficha";
import { Hilos } from "@/components/Hilos";
import { Selector } from "@/components/Selector";
import { MAX_ZOOM, MIN_ZOOM, useBoardStore } from "@/lib/store";

const ZOOM_STEP = 1.25;

export function Tablon() {
  const graph = useBoardStore((state) => state.researchCase);
  const pan = useBoardStore((state) => state.pan);
  const zoom = useBoardStore((state) => state.zoom);
  const setPan = useBoardStore((state) => state.setPan);
  const setZoom = useBoardStore((state) => state.setZoom);
  const setView = useBoardStore((state) => state.setView);
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
      ...current.cards.map((card) => ({ ...card.position, w: 240, h: 176 })),
      ...current.pins.map((pin) => ({ ...pin.position, w: 150, h: 24 })),
    ];
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const pad = 44;
    const gutterLeft = 214; // hueco de la lente
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
      if (target?.matches("input, textarea, [contenteditable=true]")) return;
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
      <div
        className="board-surface"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
      >
        <Hilos graph={graph} />
        <Caso focus={graph.focus} cards={graph.cards.length} edges={graph.edges.length} />
        {graph.cards.map((card) => <Ficha key={card.id} card={card} />)}
        {graph.pins.map((pin, index) => <Chincheta key={pin.id} pin={pin} order={index} />)}
      </div>

      <Selector />

      <div className="zoom-dock" role="group" aria-label="Zoom del tablón">
        <button type="button" onClick={() => step(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Acercar">+</button>
        <output aria-label="Nivel de zoom">{Math.round(zoom * 100)}%</output>
        <button type="button" onClick={() => step(1 / ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Alejar">−</button>
        <button type="button" className="zoom-reset" onClick={fitToContent} aria-label="Encajar el caso">◱</button>
      </div>

      <div className="board-help">ARRASTRÁ EL FONDO · RUEDA = ZOOM · +/−/0 · SIN FLECHAS</div>
    </section>
  );
}
