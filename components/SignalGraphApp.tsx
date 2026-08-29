"use client";

import { useEffect, useState } from "react";
import { LiveList } from "@liveblocks/client";
import { ClientSideSuspense } from "@liveblocks/react";
import { Bandeja } from "@/components/Bandeja";
import { Carpeta } from "@/components/Carpeta";
import { Identidad } from "@/components/Identidad";
import { Tablon } from "@/components/Tablon";
import { loadIdentity, type GuestIdentity } from "@/lib/identity";
import { useBoardStore } from "@/lib/store";
import type { SeedPayload } from "@/lib/types";
import { RoomProvider } from "@/liveblocks.config";

export function SignalGraphApp({ seed }: { seed: SeedPayload }) {
  const initialize = useBoardStore((state) => state.initialize);
  const setCaseView = useBoardStore((state) => state.setCaseView);
  const finishHydration = useBoardStore((state) => state.finishHydration);
  const hydrated = useBoardStore((state) => state.hydrated);
  const graph = useBoardStore((state) => state.researchCase);
  const toast = useBoardStore((state) => state.toast);
  const setToast = useBoardStore((state) => state.setToast);
  // Se lee de sessionStorage en un efecto (no al render) para no reventar la
  // hidratación: el servidor no tiene sessionStorage y no puede adivinarla.
  const [identity, setIdentity] = useState<GuestIdentity | null>(null);
  useEffect(() => setIdentity(loadIdentity()), []);

  useEffect(() => {
    void Promise.resolve(useBoardStore.persist.rehydrate()).then(() => {
      initialize(seed.researchCase);
      setCaseView(seed.caseView);
      finishHydration();
    });
  }, [finishHydration, initialize, setCaseView, seed.caseView, seed.researchCase]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 4200);
    return () => window.clearTimeout(timer);
  }, [setToast, toast]);

  if (!hydrated || !graph || !identity) {
    return <main className="boot-screen"><span>SG/01</span><p>ABRIENDO EL ARCHIVO…</p></main>;
  }

  return (
    <RoomProvider
      id={`signalgraph:${graph.id}`}
      initialPresence={{ cursor: null, name: identity.name, color: identity.color }}
      initialStorage={{ notas: new LiveList([]) }}
    >
      <ClientSideSuspense fallback={<main className="boot-screen"><span>SG/01</span><p>ABRIENDO EL ARCHIVO…</p></main>}>
        <main className="workbench">
          <header className="topbar">
            <div className="brand-lockup">
              <span className="brand-mark">SG</span>
              <div><h1>SIGNALGRAPH</h1><p>{graph.title}</p></div>
            </div>
            <Identidad />
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
      </ClientSideSuspense>
    </RoomProvider>
  );
}
