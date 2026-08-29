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

export function ringPosition(origin: Point, index: number): Point {
  const ring = Math.floor(index / 8);
  const slot = index % 8;
  const angle = (slot / 8) * Math.PI * 2 - Math.PI / 2;
  const radiusX = 208 + ring * 80;
  const radiusY = 144 + ring * 64;
  return snapPoint({
    x: origin.x + Math.cos(angle) * radiusX,
    y: origin.y + Math.sin(angle) * radiusY,
  });
}
