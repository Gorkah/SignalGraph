"use client";

import { useBoardStore } from "@/lib/store";
import type { Pin } from "@/lib/types";
import { useNodeDrag } from "@/components/useNodeDrag";

export function Chincheta({ pin, order }: { pin: Pin; order: number }) {
  const promotePin = useBoardStore((state) => state.promotePin);
  const busy = useBoardStore((state) => state.busy[`promote:${pin.id}`]);
  const dedup = useBoardStore((state) => state.dedup[pin.id]);
  const drag = useNodeDrag(pin.id, pin.position);
  return (
    <div
      className="pin-wrap pin-land"
      style={{ left: pin.position.x, top: pin.position.y, animationDelay: `${order * 60}ms` }}
      {...drag}
    >
      <span className="pin-dot" aria-hidden="true" />
      <button
        type="button"
        className="pin-label"
        disabled={busy}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => void promotePin(pin.id)}
        title={`${pin.relationType}: ascender ${pin.name} a ficha`}
      >
        {busy ? "abriendo…" : pin.name}
      </button>
      {dedup && <span className="dedup-badge">YA ESTABA</span>}
    </div>
  );
}
