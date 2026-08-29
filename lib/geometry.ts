import type { Point } from "@/lib/types";

export const GRID_SIZE = 16;
export const CARD_WIDTH = 240;
export const LEAD_WIDTH = 176;
export const LEAD_HEIGHT = 96;
export const CARD_HEIGHT = 240;
export const QUESTION_WIDTH = 272;
export const QUESTION_HEIGHT = 176;

export function snap(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function snapPoint(point: Point): Point {
  return { x: snap(point.x), y: snap(point.y) };
}

export function manhattanPath(start: Point, end: Point) {
  const middleX = snap((start.x + end.x) / 2);
  return `${start.x},${start.y} ${middleX},${start.y} ${middleX},${end.y} ${end.x},${end.y}`;
}


/**
 * Las chinchetas de un tirón se apilan en columna pegada a su ficha, del lado
 * que mira hacia afuera del caso. Un abanico las esparcía por el tablero y
 * obligaba a seguir un hilo largo para saber de dónde salían; en columna la
 * pertenencia se lee por proximidad y los hilos quedan cortos y paralelos.
 */
export function combPosition(origin: Point, away: Point, index: number, slots = 3): Point {
  const side = origin.x - away.x >= 0 ? 1 : -1;
  const column = Math.floor(index / slots);
  const slot = index % slots;
  const gap = CARD_WIDTH / 2 + 120 + column * (LEAD_WIDTH + 72);
  return snapPoint({
    x: side > 0 ? origin.x + gap : origin.x - gap - LEAD_WIDTH,
    // El paso vertical es la altura de la pista más aire: con el paso viejo,
    // calibrado para chinchetas de 24px, las fichas se comían unas a otras.
    y: origin.y + (slot - (slots - 1) / 2) * (LEAD_HEIGHT + 52),
  });
}

export const STACK_HEIGHT = 130;

/**
 * La cartera cerrada va al costado de su fondo y centrada con él. Reutilizar
 * `combPosition(…, 0)` la subía 148px, porque ese índice es el hueco de
 * arriba de la columna que aparecerá al desplegarla.
 */
export function portfolioPosition(origin: Point, away: Point): Point {
  const side = origin.x - away.x >= 0 ? 1 : -1;
  const gap = CARD_WIDTH / 2 + 120;
  return snapPoint({
    x: side > 0 ? origin.x + gap : origin.x - gap - LEAD_WIDTH,
    y: origin.y - STACK_HEIGHT / 2,
  });
}
