"use client";

import { manhattanPath, NOTE_HEIGHT, NOTE_WIDTH } from "@/lib/geometry";
import { useBoardStore } from "@/lib/store";
import type { ResearchCase } from "@/lib/types";
import { useMutation, useStorage } from "@/liveblocks.config";

const MARGEN = 96;

/**
 * Notas compartidas: no son ficha ni cabo, son una lectura que alguien clava
 * junto a un fondo del caso. Por eso el hilo que las une nunca lleva rótulo
 * de relación —es de autoría, no de la investigación— y se pinta punteado.
 */
export function Notas({ graph }: { graph: ResearchCase }) {
  const notas = useStorage((root) => root.notas);
  const expanded = useBoardStore((state) => state.expandedStacks);
  const quitarNota = useMutation(({ storage }, id: string) => {
    const list = storage.get("notas");
    const index = list.findIndex((nota) => nota.get("id") === id);
    if (index >= 0) list.delete(index);
  }, []);

  if (!notas?.length) return null;

  const anchors = new Map(graph.cards.map((card) => [card.id, card]));
  const visible = notas.filter((nota) => {
    const anchor = anchors.get(nota.cardId);
    // Una nota clavada en una pista que sigue dentro de un mazo cerrado se
    // esconde con ella: no hay dónde dibujarla sin adelantar el mazo.
    return anchor && (!anchor.stackId || anchor.density === "full" || expanded.includes(anchor.stackId));
  });
  if (!visible.length) return null;

  const centros = visible.map((nota) => {
    const anchor = anchors.get(nota.cardId)!;
    return {
      start: { x: anchor.position.x + 20, y: anchor.position.y + 20 },
      end: { x: nota.position.x, y: nota.position.y },
    };
  });
  const points = centros.flatMap(({ start, end }) => [start, end]);
  const minX = Math.min(...points.map((p) => p.x)) - MARGEN;
  const minY = Math.min(...points.map((p) => p.y)) - MARGEN;
  const width = Math.max(...points.map((p) => p.x)) + MARGEN - minX;
  const height = Math.max(...points.map((p) => p.y)) + MARGEN - minY;

  return (
    <>
      <svg
        className="threads notas-hilos"
        style={{ left: minX, top: minY, width, height }}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        aria-label="Notas compartidas"
      >
        {centros.map(({ start, end }, index) => (
          <polyline key={visible[index].id} points={manhattanPath(start, end)} className="nota-hilo" />
        ))}
      </svg>
      {visible.map((nota) => (
        <article
          key={nota.id}
          className="nota-card"
          style={{ left: nota.position.x, top: nota.position.y, width: NOTE_WIDTH, minHeight: NOTE_HEIGHT, ["--nota-color" as string]: nota.color }}
        >
          <button
            type="button"
            className="nota-borrar"
            aria-label={`Quitar la nota de ${nota.author}`}
            title="Quitar del tablón"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              quitarNota(nota.id);
            }}
          >
            −
          </button>
          <p>{nota.text}</p>
          <footer>
            <span>{nota.author}</span>
          </footer>
        </article>
      ))}
    </>
  );
}
