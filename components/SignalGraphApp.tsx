"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { LiveList } from "@liveblocks/client";
import { ClientSideSuspense } from "@liveblocks/react";
import { Bandeja } from "@/components/Bandeja";
import { Carpeta } from "@/components/Carpeta";
import { Identidad } from "@/components/Identidad";
import { Tablon } from "@/components/Tablon";
import { loadIdentity, type GuestIdentity } from "@/lib/identity";
import { useBoardStore } from "@/lib/store";
import { CASE_RELATION } from "@/lib/relations";
import { UI_TIMEOUTS } from "@/lib/constants";
import type { SeedPayload } from "@/lib/types";
import { RoomProvider } from "@/liveblocks.config";

function SignalGraphAppComponent({ seed }: { seed: SeedPayload }) {
  const initialize = useBoardStore((state) => state.initialize);
  const setCaseView = useBoardStore((state) => state.setCaseView);
  const finishHydration = useBoardStore((state) => state.finishHydration);
  const hydrated = useBoardStore((state) => state.hydrated);
  const graph = useBoardStore((state) => state.researchCase);
  const toast = useBoardStore((state) => state.toast);
  const setToast = useBoardStore((state) => state.setToast);
  const ui = useBoardStore((state) => state.caseView?.ui);
  const storyStarted = useBoardStore((state) => state.storyStarted);
  const startStory = useBoardStore((state) => state.startStory);
  // Se lee de sessionStorage en un efecto (no al render) para no reventar la
  // hidratación: el servidor no tiene sessionStorage y no puede adivinarla.
  const [identity, setIdentity] = useState<GuestIdentity | null>(null);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIdentity(loadIdentity());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void Promise.resolve(useBoardStore.persist.rehydrate()).then(() => {
      initialize(seed.researchCase, seed.caseView?.story?.restartOnLoad);
      setCaseView(seed.caseView);
      // Elegir el caso en la portada ya es el gesto de inicio. La ruta abre el
      // tablero directamente; no pide una segunda confirmación.
      startStory();
      finishHydration();
    });
  }, [finishHydration, initialize, setCaseView, startStory, seed.caseView, seed.researchCase]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), UI_TIMEOUTS.TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [setToast, toast]);

  if (!hydrated || !graph || !identity) {
    return <main className="boot-screen"><span>SG/01</span><p>CONSULTANDO CALA…</p></main>;
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
              <Link className="brand-mark" href="/" aria-label="Elegir otra investigación">SG</Link>
              <div><h1>SIGNALGRAPH</h1><p>{graph.title}</p></div>
            </div>
            <Identidad />
            {storyStarted && <div className="board-stats">
              <span>{ui?.cards ?? "ACTORES"} <b>{graph.cards.filter((card) => card.density === "full").length}</b></span>
              <span>{ui?.connections ?? "CONEXIONES"} <b>{graph.edges.filter((edge) => edge.relationType !== CASE_RELATION).length}</b></span>
            </div>}
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

export const SignalGraphApp = memo(SignalGraphAppComponent);
