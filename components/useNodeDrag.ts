"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useBoardStore } from "@/lib/store";
import type { Point } from "@/lib/types";

export function useNodeDrag(id: string, position: Point) {
  const moveNode = useBoardStore((state) => state.moveNode);
  const zoom = useBoardStore((state) => state.zoom);
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: Point } | null>(null);

  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: position };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.stopPropagation();
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const active = drag.current;
      if (!active || active.pointerId !== event.pointerId) return;
      // El puntero se mueve en píxeles de pantalla; la ficha vive en
      // coordenadas del tablón, así que hay que deshacer la escala.
      moveNode(id, {
        x: active.origin.x + (event.clientX - active.x) / zoom,
        y: active.origin.y + (event.clientY - active.y) / zoom,
      });
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      if (drag.current?.pointerId !== event.pointerId) return;
      drag.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
  };
}
