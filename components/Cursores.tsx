"use client";

import { useOthers } from "@/liveblocks.config";

/**
 * Cursores ajenos, pintados dentro de `board-surface`: como ese contenedor ya
 * lleva el pan/zoom aplicado, la posición del cursor se guarda y se dibuja en
 * coordenadas del tablón —igual que una ficha— sin reconvertir nada aquí.
 */
export function Cursores() {
  const others = useOthers();

  return (
    <>
      {others.map((other) => {
        if (!other.presence.cursor) return null;
        const { x, y } = other.presence.cursor;
        const name = other.presence.name?.trim();
        const color = other.presence.color || "var(--ink)";
        return (
          <div key={other.connectionId} className="cursor-remoto" style={{ left: x, top: y, ["--cursor-color" as string]: color }}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 1 L16 8 L9 9.5 L7 16 Z" fill={color} stroke="var(--paper)" strokeWidth="1" />
            </svg>
            {/* Sin nombre puesto, solo la punta de color: nada de rellenar con
                un "Investigador" que nadie escribió. */}
            {name && <span className="cursor-etiqueta">{name}</span>}
          </div>
        );
      })}
    </>
  );
}
