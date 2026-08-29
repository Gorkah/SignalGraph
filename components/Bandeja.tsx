"use client";

import { useEffect, useRef, useState } from "react";
import { useBoardStore } from "@/lib/store";
import type { Dossier, SeedPayload } from "@/lib/types";

function ReceiptTimer({ startedAt }: { startedAt: number }) {
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() - startedAt) / 1000));
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return <time>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</time>;
}

/**
 * Pedir un dossier nuevo al archivo. Es una vía viva —consulta a Cala y
 * candidatas que se clavan en el corcho—, pero no participa en el relato del
 * caso: mientras nadie la usa, un cuarto de pantalla de formulario compite con
 * el corcho por la atención de la sala. Así que arranca plegada en un canto y
 * se despliega cuando hace falta; el corcho se queda con el ancho.
 */
export function Bandeja({ fallbackDossier, defaultReportQuery }: Pick<SeedPayload, "fallbackDossier" | "defaultReportQuery">) {
  const [query, setQuery] = useState(defaultReportQuery);
  const [abierta, setAbierta] = useState(false);
  const inbox = useBoardStore((state) => state.inbox);
  const addReceipt = useBoardStore((state) => state.addReceipt);
  const deliverDossier = useBoardStore((state) => state.deliverDossier);
  const pinCandidate = useBoardStore((state) => state.pinCandidate);
  const setToast = useBoardStore((state) => state.setToast);
  const forceFallback = useRef<(() => void) | null>(null);
  const llegados = inbox.filter((item) => item.state === "arrived").length;
  const panelLabel = useBoardStore((state) => state.caseView?.ui?.archivePanel) ?? "NUEVA CONSULTA";

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key.toLowerCase() !== "d" || target?.matches("input, textarea, [contenteditable=true]")) return;
      forceFallback.current?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  async function submit() {
    const input = query.trim();
    if (!input) return;
    const id = crypto.randomUUID();
    let settled = false;
    const localDelivery = () => {
      if (settled) return;
      settled = true;
      const dossier: Dossier = {
        ...fallbackDossier,
        id: `fallback-${id}`,
        deliveredAt: new Date().toISOString(),
        source: "fallback",
      };
      deliverDossier(id, dossier);
      setToast("Dossier local entregado: la investigación sigue disponible sin red.");
    };
    forceFallback.current = localDelivery;
    addReceipt({ id, query: input, startedAt: Date.now(), state: "pending" });
    const fallbackTimer = window.setTimeout(localDelivery, 90_000);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode: "live" }),
      });
      const body = await response.json() as Dossier & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Cala no responde");
      if (!settled) {
        settled = true;
        deliverDossier(id, body);
      }
    } catch (error) {
      if (!settled) {
        setToast(error instanceof Error ? `${error.message}. Activando copia local.` : "Activando copia local.");
        localDelivery();
      }
    } finally {
      window.clearTimeout(fallbackTimer);
      if (forceFallback.current === localDelivery) forceFallback.current = null;
    }
  }

  if (!abierta) {
    return (
      <aside className="inbox is-plegada" aria-label="Bandeja de dossieres">
        <button
          type="button"
          className="inbox-canto"
          aria-expanded={false}
          title="Pedir un dossier nuevo a Cala"
          onClick={() => setAbierta(true)}
        >
          <span aria-hidden="true">▸</span>
          <span className="inbox-canto-rotulo">{panelLabel}</span>
          {llegados > 0 && <b>{llegados}</b>}
        </button>
      </aside>
    );
  }

  return (
    <aside className="inbox" aria-label="Bandeja de dossieres">
      <header>
        <button
          type="button"
          className="inbox-plegar"
          aria-expanded
          title="Plegar la bandeja y devolverle el ancho al corcho"
          onClick={() => setAbierta(false)}
        >
          ▸
        </button>
        <span>{panelLabel}</span>
        <b>{llegados}</b>
      </header>
      <div className="query-box">
        <label htmlFor="archive-query">Pregunta a Cala</label>
        <textarea id="archive-query" value={query} onChange={(event) => setQuery(event.target.value)} rows={2} />
        <button className="primary-button" type="button" onClick={() => void submit()}>pedir dossier</button>
      </div>
      <div className="receipt-stack">
        {inbox.length === 0 && <p className="empty-inbox">Ningún dossier pedido. Esta vía abre un caso nuevo; el del corcho ya está servido.</p>}
        {inbox.map((receipt) => (
          <article className={`receipt is-${receipt.state}`} key={receipt.id}>
            <div className="receipt-head">
              <span>{receipt.state === "pending" ? "BUSCANDO…" : receipt.state === "arrived" ? "HA LLEGADO" : "NO LLEGÓ"}</span>
              {receipt.state === "pending" && <ReceiptTimer startedAt={receipt.startedAt} />}
            </div>
            <p>{receipt.query}</p>
            {receipt.dossier && (
              <div className="candidate-fan">
                <small>{receipt.dossier.candidates.length} resultados · clic para añadirlos</small>
                {receipt.dossier.candidates.slice(0, 8).map((candidate, index) => (
                  <button
                    key={`${candidate.id ?? candidate.name}-${index}`}
                    type="button"
                    disabled={!candidate.id}
                    title={candidate.id ? "Pinear candidata" : "Sin UUID fiable"}
                    onClick={() => pinCandidate(candidate)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>{candidate.name}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
