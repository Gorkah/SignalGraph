"use client";

import { useBoardStore } from "@/lib/store";
import type { SelectorMode } from "@/lib/types";

const OPTIONS: Array<{ value: SelectorMode; label: string; hint: string }> = [
  { value: "description", label: "descripción", hint: "qué es" },
  { value: "money", label: "dinero", hint: "cuánto levantó" },
  { value: "city", label: "ciudad", hint: "dónde está" },
  { value: "latest", label: "lo último", hint: "qué se sabe hoy" },
];

/**
 * No es una barra de pestañas: es la lente con la que se lee TODO el tablón
 * a la vez. Vertical y anclada al corcho, para que se lea como instrumento.
 */
export function Selector() {
  const selector = useBoardStore((state) => state.selector);
  const setSelector = useBoardStore((state) => state.setSelector);
  return (
    <div className="lens-dock" role="radiogroup" aria-label="Dato visible en todas las fichas">
      <span className="lens-title">LENTE</span>
      {OPTIONS.map((option) => {
        const active = selector === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? "is-active" : undefined}
            onClick={() => setSelector(option.value)}
          >
            <i aria-hidden="true">{active ? "◆" : "◇"}</i>
            <span>{option.label}</span>
            <small>{option.hint}</small>
          </button>
        );
      })}
    </div>
  );
}
