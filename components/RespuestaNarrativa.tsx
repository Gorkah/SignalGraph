"use client";

import { useNodeDrag } from "@/components/useNodeDrag";
import { useBoardStore } from "@/lib/store";
import type { EntityCard } from "@/lib/types";

export function RespuestaNarrativa({ card }: { card: EntityCard }) {
  const story = card.story!;
  const selected = useBoardStore((state) => state.selectedId === card.id);
  const selectNode = useBoardStore((state) => state.selectNode);
  const drag = useNodeDrag(card.id, card.position);

  return (
    <article
      className={`entity-card story-card ${selected ? "is-selected" : ""}`}
      style={{ left: card.position.x, top: card.position.y }}
      onClick={() => selectNode(card.id)}
      data-category={story.beat}
    >
      <header className="story-drag" {...drag} title="Arrastrá para mover la respuesta">
        <span className="story-ai">AI</span>
        <span>
          <strong>{story.title}</strong>
          <small>{story.beat} · respuesta verificada</small>
        </span>
      </header>
      <div className="story-body">
        <small>{story.question}</small>
        <p>{story.answer}</p>
        <blockquote><b>PORQUE</b> {story.because}</blockquote>
      </div>
      <footer>
        <span>{Math.round(story.confidence * 100)}% confianza</span>
        <span>{story.provider === "openai" ? "OPENAI" : "OPENAI · PIONEER"}</span>
      </footer>
    </article>
  );
}
