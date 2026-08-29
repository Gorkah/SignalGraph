"use client";

import { CARD_HEIGHT, CARD_WIDTH, LEAD_HEIGHT, LEAD_WIDTH, QUESTION_HEIGHT, QUESTION_WIDTH, manhattanPath } from "@/lib/geometry";
import { CASE_RELATION, relationNoun } from "@/lib/relations";
import { useBoardStore } from "@/lib/store";
import type { ResearchCase } from "@/lib/types";

const COLORS: Record<string, string> = {
  INVESTED_IN: "var(--thread-investment)",
  FINANCED: "var(--thread-finance)",
  REPORT_MATCH: "var(--thread-report)",
  [CASE_RELATION]: "var(--thread-case)",
  AFFECTS_INDUSTRY: "var(--thread-law)",
};

const CASE_WIDTH = 296;
const CASE_HEIGHT = 184;

// Aire alrededor del recuadro de hilos: cubre el grosor del trazo y los
// rótulos, que se salen un poco de los centros que unen.
const MARGEN = 96;

export function Hilos({ graph }: { graph: ResearchCase }) {
  const expanded = useBoardStore((state) => state.expandedStacks);

  // Un mazo cerrado es una sola cosa en el tablón: sus hilos convergen en el
  // ancla del mazo en vez de abrirse en abanico hacia pistas invisibles.
  const stackAnchor = new Map<string, { x: number; y: number }>();
  for (const card of graph.cards) {
    if (!card.stackId || card.density !== "lead" || expanded.includes(card.stackId)) continue;
    if (!stackAnchor.has(card.stackId)) {
      stackAnchor.set(card.stackId, {
        x: card.position.x + LEAD_WIDTH / 2,
        y: card.position.y + LEAD_HEIGHT / 2,
      });
    }
  }

  const nodes = new Map<string, { x: number; y: number }>([
    [graph.focus.id, {
      x: graph.focus.position.x + CASE_WIDTH / 2,
      y: graph.focus.position.y + CASE_HEIGHT / 2,
    }],
    ...graph.cards.map((card) => {
      const collapsed = card.stackId && card.density === "lead" ? stackAnchor.get(card.stackId) : undefined;
      if (collapsed) return [card.id, collapsed] as const;
      const width = card.density === "lead" ? LEAD_WIDTH : CARD_WIDTH;
      const height = card.density === "lead" ? LEAD_HEIGHT : CARD_HEIGHT;
      return [card.id, { x: card.position.x + width / 2, y: card.position.y + height / 2 }] as const;
    }),
    ...graph.questions.map((question) => [question.id, {
      x: question.position.x + QUESTION_WIDTH / 2,
      y: question.position.y + QUESTION_HEIGHT / 2,
    }] as const),
  ]);

  // Solo se rotula lo que une dos fichas completas: una pista ya viene
  // explicada por el cabo del que salió.
  const fullIds = new Set(graph.cards.filter((card) => card.density === "full").map((card) => card.id));

  // El lienzo se ajusta a lo que hay que dibujar en vez de a un tamaño fijo:
  // ningún hilo se corta por lejos que se arrastre una ficha, y no queda un
  // rectángulo invisible marcando dónde acaba el tablón.
  const centros = [...nodes.values()];
  if (!centros.length) return null;
  const minX = Math.min(...centros.map((point) => point.x)) - MARGEN;
  const minY = Math.min(...centros.map((point) => point.y)) - MARGEN;
  const width = Math.max(...centros.map((point) => point.x)) + MARGEN - minX;
  const height = Math.max(...centros.map((point) => point.y)) + MARGEN - minY;

  return (
    <svg
      className="threads"
      style={{ left: minX, top: minY, width, height }}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      aria-label="Relaciones del grafo"
    >
      {graph.edges.map((edge) => {
        const start = nodes.get(edge.sourceId);
        const end = nodes.get(edge.targetId);
        if (!start || !end) return null;
        const points = manhattanPath(start, end);
        const isCase = edge.relationType === CASE_RELATION;
        const labelled = !isCase && fullIds.has(edge.sourceId) && fullIds.has(edge.targetId);
        const details = [
          `${relationNoun(edge.relationType)} · ${edge.relationType}`,
          "dirección sin verificar",
          edge.source?.query,
        ].filter(Boolean).join("\n");
        return (
          <g className={`thread ${isCase ? "is-case" : ""}`} key={edge.id}>
            <title>{details}</title>
            <polyline className="thread-hit" points={points} />
            <polyline points={points} style={{ stroke: COLORS[edge.relationType] ?? "var(--thread-default)" }} />
            {labelled && (
              <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 7}>
                {relationNoun(edge.relationType)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
