"use client";

import { useEffect } from "react";
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/geometry";
import { useBoardStore } from "@/lib/store";

const NOTE_WIDTH = 276;
const NOTE_GAP = 38;

/**
 * Borrador efímero unido a la ficha actual. No entra en el grafo hasta que el
 * usuario lo acepta con Tab; después, sus resultados sí nacen como pistas.
 */
export function PreguntaPotencial() {
  const graph = useBoardStore((state) => state.researchCase);
  const selectedId = useBoardStore((state) => state.selectedId);
  const draft = useBoardStore((state) => selectedId ? state.questionDrafts[selectedId] : undefined);
  const status = useBoardStore((state) => selectedId ? state.questionStatus[selectedId] : undefined);
  const suggestQuestion = useBoardStore((state) => state.suggestQuestion);
  const continueQuestion = useBoardStore((state) => state.continueQuestion);
  const card = graph?.cards.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!card || card.density !== "full") return;
    void suggestQuestion(card.id);
  }, [card, suggestQuestion]);

  useEffect(() => {
    if (!card || !draft?.question || status !== "ready") return;
    function acceptWithTab(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "Tab"
        || event.shiftKey
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || target?.closest("input, textarea, [contenteditable=true]")
      ) return;
      event.preventDefault();
      void continueQuestion(card!.id);
    }
    window.addEventListener("keydown", acceptWithTab);
    return () => window.removeEventListener("keydown", acceptWithTab);
  }, [card, continueQuestion, draft?.question, status]);

  if (!graph || !card || !draft?.question || (status !== "ready" && status !== "asking")) return null;
  const focusCentre = graph.focus.position.x + 148;
  const cardCentre = card.position.x + CARD_WIDTH / 2;
  // La carpeta ocupa el lateral derecho de la mesa al seleccionar una ficha.
  // La nota crece hacia el centro del caso para seguir unida al nodo sin
  // quedar escondida debajo de ese panel.
  const goesRight = cardCentre < focusCentre;
  const x = goesRight
    ? card.position.x + CARD_WIDTH + NOTE_GAP
    : card.position.x - NOTE_WIDTH - NOTE_GAP;
  const y = card.position.y + Math.max(12, (CARD_HEIGHT - 168) / 2);

  return (
    <aside
      className={`potential-question ${goesRight ? "is-right" : "is-left"} ${status === "asking" ? "is-asking" : ""}`}
      style={{ left: x, top: y }}
      aria-label="Siguiente pregunta potencial"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header><span>{draft.provider === "openai" ? "OPENAI" : "OPENAI · PIONEER"}</span><b>BORRADOR</b></header>
      <p>{draft.question}</p>
      <footer>
        {status === "asking"
          ? <span>buscando evidencia y redactando…</span>
          : <><kbd>Tab</kbd><span>responder y seguir</span></>}
      </footer>
    </aside>
  );
}
