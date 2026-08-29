"use client";

import { memo, useEffect } from "react";
import { Bandeja } from "@/components/Bandeja";
import { Carpeta } from "@/components/Carpeta";
import { Tablon } from "@/components/Tablon";
import { useBoardStore } from "@/lib/store";
import { UI_TIMEOUTS } from "@/lib/constants";
import type { SeedPayload } from "@/lib/types";

function SignalGraphAppComponent({ seed }: { seed: SeedPayload }) {
  const initialize = useBoardStore((state) => state.initialize);
  const setCaseView = useBoardStore((state) => state.setCaseView);
  const finishHydration = useBoardStore((state) => state.finishHydration);
  const hydrated = useBoardStore((state) => state.hydrated);
  const graph = useBoardStore((state) => state.researchCase);
  const toast = useBoardStore((state) => state.toast);
  const setToast = useBoardStore((state) => state.setToast);

  useEffect(() => {
    void Promise.resolve(useBoardStore.persist.rehydrate()).then(() => {
      initialize(seed.researchCase);
      setCaseView(seed.caseView);
      finishHydration();
    });
  }, [finishHydration, initialize, setCaseView, seed.caseView, seed.researchCase]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), UI_TIMEOUTS.TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [setToast, toast]);

  if (!hydrated || !graph) {
    return <main className="boot-screen"><span>SG/01</span><p>ABRIENDO EL ARCHIVO…</p></main>;
  }

  return (
    <main className="workbench">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">SG</span>
          <div><h1>SIGNALGRAPH</h1><p>{graph.title}</p></div>
        </div>
        <div className="board-stats">
          <span>FICHAS <b>{graph.cards.filter((card) => card.density === "full").length}</b></span>
          <span>PISTAS <b>{graph.cards.filter((card) => card.density === "lead").length}</b></span>
          <span>HILOS <b>{graph.edges.length}</b></span>
        </div>
      </header>
      <div className="workspace">
        <Tablon />
        <Bandeja fallbackDossier={seed.fallbackDossier} defaultReportQuery={seed.defaultReportQuery} />
        <Carpeta />
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

export const SignalGraphApp = memo(SignalGraphAppComponent);
