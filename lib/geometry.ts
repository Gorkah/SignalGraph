import type { Point } from "@/lib/types";

export const GRID_SIZE = 16;
export const CARD_WIDTH = 240;
export const CARD_HEIGHT = 176;

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

export const PIN_WIDTH = 150;

/**
 * Las chinchetas de un tirón se apilan en columna pegada a su ficha, del lado
 * que mira hacia afuera del caso. Un abanico las esparcía por el tablero y
 * obligaba a seguir un hilo largo para saber de dónde salían; en columna la
 * pertenencia se lee por proximidad y los hilos quedan cortos y paralelos.
 */
export function combPosition(origin: Point, away: Point, index: number, slots = 8): Point {
  const side = origin.x - away.x >= 0 ? 1 : -1;
  const column = Math.floor(index / slots);
  const slot = index % slots;
  const gap = CARD_WIDTH / 2 + 84 + column * (PIN_WIDTH + 34);
  return snapPoint({
    x: side > 0 ? origin.x + gap : origin.x - gap - PIN_WIDTH,
    y: origin.y + (slot - (slots - 1) / 2) * 36,
  });
}
