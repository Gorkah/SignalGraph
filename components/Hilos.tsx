"use client";

import { CARD_HEIGHT, CARD_WIDTH, manhattanPath } from "@/lib/geometry";
import type { ResearchCase } from "@/lib/types";

const COLORS: Record<string, string> = {
  INVESTED_IN: "var(--thread-investment)",
  FINANCED: "var(--thread-finance)",
  REPORT_MATCH: "var(--thread-report)",
  "LÍNEA DE CASO": "var(--thread-case)",
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

  return (
    <svg className="threads" width="2200" height="1300" aria-label="Relaciones del grafo">
      {graph.edges.map((edge) => {
        const start = nodes.get(edge.sourceId);
        const end = nodes.get(edge.targetId);
        if (!start || !end) return null;
        const points = manhattanPath(start, end);
        const labelX = (start.x + end.x) / 2;
        const labelY = (start.y + end.y) / 2;
        const details = edge.source ? `${edge.relationType} · ${edge.source.query}` : edge.relationType;
        const isCase = edge.relationType === "LÍNEA DE CASO";
        return (
          <g className={`thread ${isCase ? "is-case" : ""}`} key={edge.id}>
            <title>{details}</title>
            <polyline className="thread-hit" points={points} />
            <polyline points={points} style={{ stroke: COLORS[edge.relationType] ?? "var(--thread-default)" }} />
            {!isCase && <text x={labelX} y={labelY - 7}>{edge.relationType}</text>}
          </g>
        );
      })}
    </svg>
  );
}
