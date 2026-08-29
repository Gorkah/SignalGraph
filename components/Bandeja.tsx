"use client";

import { useEffect, useRef, useState } from "react";
import { useBoardStore } from "@/lib/store";
import { UI_TIMEOUTS } from "@/lib/constants";
import type { Dossier, SeedPayload } from "@/lib/types";

function ReceiptTimer({ startedAt }: { startedAt: number }) {
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() - startedAt) / 1000));
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return <time>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</time>;
}

export function Bandeja({ fallbackDossier, defaultReportQuery }: Pick<SeedPayload, "fallbackDossier" | "defaultReportQuery">) {
  const [query, setQuery] = useState(defaultReportQuery);
  const [openingCase, setOpeningCase] = useState(false);
  const inbox = useBoardStore((state) => state.inbox);
  const addReceipt = useBoardStore((state) => state.addReceipt);
  const deliverDossier = useBoardStore((state) => state.deliverDossier);
  const pinCandidate = useBoardStore((state) => state.pinCandidate);
  const startResearch = useBoardStore((state) => state.startResearch);
  const setToast = useBoardStore((state) => state.setToast);
  const forceFallback = useRef<(() => void) | null>(null);

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
    const fallbackTimer = window.setTimeout(localDelivery, UI_TIMEOUTS.FALLBACK_DELIVERY_MS);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode: "live" }),
      });
      const body = await response.json() as Dossier & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "El archivo no responde");
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

  async function openNewCase() {
    const input = query.trim();
    if (!input || openingCase) return;
    const id = crypto.randomUUID();
    setOpeningCase(true);
    addReceipt({ id, query: input, startedAt: Date.now(), state: "pending" });
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode: "live" }),
      });
      const body = await response.json() as Dossier & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "El archivo no responde");
      const dossier: Dossier = body.candidates.length ? body : {
        ...fallbackDossier,
        id: `fallback-${id}`,
        query: input,
        deliveredAt: new Date().toISOString(),
        source: "fallback",
      };
      deliverDossier(id, dossier);
      if (!body.candidates.length) setToast("Sin coincidencias en vivo: abriendo con evidencia local disponible.");
      await startResearch(input, dossier);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo abrir el caso";
      useBoardStore.getState().failReceipt(id, message);
      setToast(message);
    } finally {
      setOpeningCase(false);
    }
  }

  return (
    <aside className="inbox" aria-label="Bandeja de dossieres">
      <header>
        <span>DOSSIERES PEDIDOS</span>
        <b>{inbox.filter((item) => item.state === "arrived").length}</b>
      </header>
      <div className="query-box">
        <label htmlFor="archive-query">Preguntá al archivo</label>
        <textarea id="archive-query" value={query} onChange={(event) => setQuery(event.target.value)} rows={2} />
        <div className="query-actions">
          <button className="primary-button" type="button" disabled={openingCase} onClick={() => void openNewCase()}>
            {openingCase ? "abriendo caso…" : "abrir caso nuevo"}
          </button>
          <button className="secondary-button" type="button" disabled={openingCase} onClick={() => void submit()}>solo pedir dossier</button>
        </div>
      </div>
      <div className="receipt-stack">
        {inbox.length === 0 && <p className="empty-inbox">Todavía no hay resguardos.</p>}
        {inbox.map((receipt) => (
          <article className={`receipt is-${receipt.state}`} key={receipt.id}>
            <div className="receipt-head">
              <span>{receipt.state === "pending" ? "BUSCANDO…" : receipt.state === "arrived" ? "HA LLEGADO" : "NO LLEGÓ"}</span>
              {receipt.state === "pending" && <ReceiptTimer startedAt={receipt.startedAt} />}
            </div>
            <p>{receipt.query}</p>
            {receipt.dossier && receipt.dossier.candidates.length > 0 && (
              <div className="candidate-fan">
                <small>{receipt.dossier.candidates.length} pistas · clic para clavarlas</small>
                <button className="receipt-open-case" type="button" onClick={() => void startResearch(receipt.query, receipt.dossier!)}>
                  <span>↳</span> abrir este dossier como caso
                </button>
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
