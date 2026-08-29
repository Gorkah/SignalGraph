"use client";

import { useBoardStore } from "@/lib/store";
import type { QuestionNode } from "@/lib/types";

export function Pregunta({ question }: { question: QuestionNode }) {
  const answerQuestion = useBoardStore((state) => state.answerQuestion);
  const busy = useBoardStore((state) => state.busy[`question:${question.id}`]);
  const budget = useBoardStore((state) => state.archiveBudget);
  const answered = question.state === "answered";
  const archive = question.lane === "archive";
  const ui = useBoardStore((state) => state.caseView?.ui);

  return (
    <article
      className={`question-node is-${question.lane} ${answered ? "is-answered" : ""}`}
      style={{ left: question.position.x, top: question.position.y }}
    >
      <header>
        <span>{archive ? (ui?.archiveQuestion ?? "DATO DE CALA") : (ui?.externalQuestion ?? "CONTEXTO EXTERNO")}</span>
        <b>{archive ? `${budget}/10` : "WEB"}</b>
      </header>
      {!answered ? (
        <>
          <p>{question.prompt}</p>
          <button type="button" disabled={busy} onClick={() => void answerQuestion(question.id)}>
            {busy ? "buscando…" : archive ? (ui?.askArchive ?? "consultar ▸") : (ui?.askExternal ?? "ver contexto ▸")}
          </button>
        </>
      ) : (
        <div className="question-answer">
          <strong>{question.answer.title}</strong>
          <p>{question.answer.body}</p>
          <small>
            {question.answer.sourceUrl ? (
              <a href={question.answer.sourceUrl} target="_blank" rel="noreferrer">{question.answer.sourceLabel}</a>
            ) : question.answer.sourceLabel}
            {question.answer.asOf ? ` · ${question.answer.asOf}` : ""}
          </small>
        </div>
      )}
    </article>
  );
}
