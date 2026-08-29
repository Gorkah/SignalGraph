import {
  CARD_HEIGHT,
  CARD_WIDTH,
  LEAD_HEIGHT,
  LEAD_WIDTH,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  portfolioPosition,
  STACK_HEIGHT,
} from "@/lib/geometry";
import type { NotaPayload } from "@/liveblocks.config";
import type { Point, ResearchCase } from "@/lib/types";

type Box = { x: number; y: number; w: number; h: number };

const CASE_WIDTH = 296;
const CASE_HEIGHT = 184;
const MARGIN = 16;

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + b.w + MARGIN &&
    a.x + a.w + MARGIN > b.x &&
    a.y < b.y + b.h + MARGIN &&
    a.y + a.h + MARGIN > b.y
  );
}

/** Todo lo que ya ocupa sitio en el tablón: el caso, cada ficha o pista, la
 *  cartera cerrada de los fondos sin tirar, y las notas que ya hay clavadas. */
function occupiedBoxes(graph: ResearchCase, portfolioRelation: string, notas: readonly NotaPayload[]): Box[] {
  const boxes: Box[] = [
    { x: graph.focus.position.x, y: graph.focus.position.y, w: CASE_WIDTH, h: CASE_HEIGHT },
  ];
  const pulled = new Set(graph.cards.map((card) => card.stackId).filter(Boolean));
  for (const card of graph.cards) {
    const size = card.density === "lead" ? { w: LEAD_WIDTH, h: LEAD_HEIGHT } : { w: CARD_WIDTH, h: CARD_HEIGHT };
    boxes.push({ x: card.position.x, y: card.position.y, ...size });
    if (card.density === "full" && !card.parentId && !pulled.has(`${card.id}:${portfolioRelation}`)) {
      const cartera = portfolioPosition(
        { x: card.position.x + CARD_WIDTH / 2, y: card.position.y + CARD_HEIGHT / 2 },
        graph.focus.position,
      );
      boxes.push({ x: cartera.x, y: cartera.y, w: LEAD_WIDTH, h: STACK_HEIGHT });
    }
  }
  for (const nota of notas) {
    boxes.push({ x: nota.position.x, y: nota.position.y, w: NOTE_WIDTH, h: NOTE_HEIGHT });
  }
  return boxes;
}

/**
 * Un sitio para la nota que no tape nada desde el primer momento: se prueba
 * en anillos crecientes alrededor de la ficha —arriba primero, que es donde
 * casi nunca hay nada— y se clava en el primer hueco libre. Si el tablón
 * está completamente cubierto (no debería pasar salvo casos extremos), cae
 * en el primer candidato antes que no crear la nota.
 */
export function placeNota(anchor: Point, graph: ResearchCase, portfolioRelation: string, notas: readonly NotaPayload[]): Point {
  const occupied = occupiedBoxes(graph, portfolioRelation, notas);
  const step = NOTE_WIDTH + 16;
  const rise = NOTE_HEIGHT + 24;
  const candidates: Point[] = [];
  for (let ring = 0; ring < 5; ring += 1) {
    const dy = -rise * (ring + 1);
    for (const dx of [0, step, -step, step * 2, -step * 2]) {
      candidates.push({ x: anchor.x + (CARD_WIDTH - NOTE_WIDTH) / 2 + dx, y: anchor.y + dy });
    }
  }
  // Si arriba no cabe en ningún anillo, abajo y a los lados como último recurso.
  candidates.push(
    { x: anchor.x + (CARD_WIDTH - NOTE_WIDTH) / 2, y: anchor.y + CARD_HEIGHT + 24 },
    { x: anchor.x - NOTE_WIDTH - 24, y: anchor.y },
    { x: anchor.x + CARD_WIDTH + 24, y: anchor.y },
  );

  for (const candidate of candidates) {
    const box = { x: candidate.x, y: candidate.y, w: NOTE_WIDTH, h: NOTE_HEIGHT };
    if (!occupied.some((other) => overlaps(box, other))) return candidate;
  }
  return candidates[0];
}
