"use client";

import { CARD_HEIGHT, CARD_WIDTH, PIN_WIDTH, manhattanPath } from "@/lib/geometry";
import { CASE_RELATION, relationNoun } from "@/lib/relations";
import type { ResearchCase } from "@/lib/types";

const COLORS: Record<string, string> = {
  INVESTED_IN: "var(--thread-investment)",
  FINANCED: "var(--thread-finance)",
  REPORT_MATCH: "var(--thread-report)",
  [CASE_RELATION]: "var(--thread-case)",
};

const CASE_WIDTH = 296;
const CASE_HEIGHT = 184;

export function Hilos({ graph }: { graph: ResearchCase }) {
  const nodes = new Map<string, { x: number; y: number }>([
    [graph.focus.id, {
      x: graph.focus.position.x + CASE_WIDTH / 2,
      y: graph.focus.position.y + CASE_HEIGHT / 2,
    }],
    ...graph.cards.map((card) => [card.id, { x: card.position.x + CARD_WIDTH / 2, y: card.position.y + CARD_HEIGHT / 2 }] as const),
    ...graph.pins.map((pin) => [pin.id, { x: pin.position.x + 6, y: pin.position.y + 6 }] as const),
  ]);

  // Las chinchetas se apilan a un lado u otro de su ficha; el hilo debe entrar
  // por el borde que mira a la ficha, no cruzando la etiqueta.
  const pinIds = new Set(graph.pins.map((pin) => pin.id));
  function anchor(id: string, towards: { x: number; y: number }) {
    const node = nodes.get(id);
    if (!node || !pinIds.has(id)) return node;
    return towards.x > node.x ? { x: node.x + PIN_WIDTH - 12, y: node.y } : node;
  }

  // Solo se rotula lo que une dos fichas: una chincheta ya viene explicada
  // por el cabo del que salió, y cuatro rótulos juntos tapaban la ficha padre.
  const cardIds = new Set(graph.cards.map((card) => card.id));

  return (
    <svg className="threads" width="2200" height="1300" aria-label="Relaciones del grafo">
      {graph.edges.map((edge) => {
        const rawStart = nodes.get(edge.sourceId);
        const rawEnd = nodes.get(edge.targetId);
        if (!rawStart || !rawEnd) return null;
        const start = anchor(edge.sourceId, rawEnd)!;
        const end = anchor(edge.targetId, rawStart)!;
        const points = manhattanPath(start, end);
        const labelX = (start.x + end.x) / 2;
        const labelY = (start.y + end.y) / 2;
        const details = [
          `${relationNoun(edge.relationType)} · ${edge.relationType}`,
          "dirección sin verificar",
          edge.source?.query,
        ].filter(Boolean).join("\n");
        const isCase = edge.relationType === CASE_RELATION;
        const betweenCards = cardIds.has(edge.sourceId) && cardIds.has(edge.targetId);
        return (
          <g className={`thread ${isCase ? "is-case" : ""}`} key={edge.id}>
            <title>{details}</title>
            <polyline className="thread-hit" points={points} />
            <polyline points={points} style={{ stroke: COLORS[edge.relationType] ?? "var(--thread-default)" }} />
            {!isCase && betweenCards && <text x={labelX} y={labelY - 7}>{relationNoun(edge.relationType)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
