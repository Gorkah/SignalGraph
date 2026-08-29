"use client";

import { saveIdentity } from "@/lib/identity";
import { useMyPresence } from "@/liveblocks.config";

/**
 * Cómo te ve el resto: tu nombre en el cursor y en la firma de tus notas.
 * Siempre visible —así se puede poner nombre antes de que llegue nadie más—
 * pero nunca con un "Investigador NN" de relleno: vacío hasta que alguien
 * escribe el suyo.
 */
export function Identidad() {
  const [{ name, color }, updateMyPresence] = useMyPresence();

  return (
    <label className="identidad" style={{ ["--identidad-color" as string]: color }}>
      <span>SOY</span>
      <input
        value={name}
        placeholder="tu nombre…"
        maxLength={24}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value;
          updateMyPresence({ name: next });
          saveIdentity({ name: next, color });
        }}
      />
    </label>
  );
}
