"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CARD_HEIGHT, CARD_WIDTH, combPosition, snapPoint } from "@/lib/geometry";
import { CASE_RELATION } from "@/lib/relations";
import type {
  Dossier,
  DossierCandidate,
  EntityCard,
  InboxReceipt,
  IntrospectionResponse,
  Point,
  ProjectionResponse,
  ResearchCase,
  SelectorMode,
} from "@/lib/types";

type BoardState = {
  researchCase: ResearchCase | null;
  selector: SelectorMode;
  pan: Point;
  zoom: number;
  inbox: InboxReceipt[];
  selectedId?: string;
  hydrated: boolean;
  busy: Record<string, boolean>;
  dedup: Record<string, boolean>;
  toast?: string;
  initialize: (researchCase: ResearchCase) => void;
  finishHydration: () => void;
  setSelector: (selector: SelectorMode) => void;
  setPan: (pan: Point) => void;
  setZoom: (zoom: number, anchor?: Point) => void;
  setView: (view: { pan: Point; zoom: number }) => void;
  framedCaseId?: string;
  moveNode: (id: string, point: Point) => void;
  selectNode: (id?: string) => void;
  pullRelation: (entityId: string, relationType: string) => Promise<void>;
  promotePin: (id: string) => Promise<void>;
  addReceipt: (receipt: InboxReceipt) => void;
  deliverDossier: (receiptId: string, dossier: Dossier) => void;
  failReceipt: (receiptId: string, error: string) => void;
  pinCandidate: (candidate: DossierCandidate) => void;
  setToast: (toast?: string) => void;
};

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error ?? "El archivo no responde");
  return body;
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      researchCase: null,
      selector: "description",
      pan: { x: 40, y: 24 },
      zoom: 1,
      inbox: [],
      hydrated: false,
      busy: {},
      dedup: {},

      initialize: (researchCase) => set((state) => ({
        researchCase: state.researchCase?.id === researchCase.id ? state.researchCase : researchCase,
      })),
      finishHydration: () => set({ hydrated: true }),
      setSelector: (selector) => set({ selector }),
      setPan: (pan) => set({ pan }),
      // El anclaje mantiene quieto el punto del tablón que hay bajo el cursor.
      setZoom: (zoom, anchor) => set((state) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
        if (!anchor) return { zoom: next };
        const ratio = next / state.zoom;
        return {
          zoom: next,
          pan: {
            x: anchor.x - (anchor.x - state.pan.x) * ratio,
            y: anchor.y - (anchor.y - state.pan.y) * ratio,
          },
        };
      }),
      setView: ({ pan, zoom }) => set({ pan, zoom }),
      setToast: (toast) => set({ toast }),
      selectNode: (selectedId) => set({ selectedId }),
      moveNode: (id, point) => set((state) => {
        if (!state.researchCase) return state;
        const position = snapPoint(point);
        return {
          researchCase: {
            ...state.researchCase,
            cards: state.researchCase.cards.map((card) => card.id === id ? { ...card, position } : card),
            pins: state.researchCase.pins.map((pin) => pin.id === id ? { ...pin, position } : pin),
          },
        };
      }),

      pullRelation: async (entityId, relationType) => {
        const busyKey = `${entityId}:${relationType}`;
        if (get().busy[busyKey]) return;
        set((state) => ({ busy: { ...state.busy, [busyKey]: true }, toast: undefined }));
        try {
          const projection = await apiJson<ProjectionResponse>(`/api/entity/${encodeURIComponent(entityId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projection: relationType, limit: 8 }),
          });
          if (projection.entities.length === 0) {
            set({ toast: "No hay más evidencia local para este cabo." });
            return;
          }
          for (const [index, entity] of projection.entities.entries()) {
            await delay(index === 0 ? 0 : 60);
            set((state) => {
              if (!state.researchCase) return state;
              const graph = state.researchCase;
              const existingCard = graph.cards.find((card) => card.id === entity.id);
              const existingPin = graph.pins.find((pin) => pin.id === entity.id);
              const alreadyLinked = graph.edges.some((edge) => edge.sourceId === entityId && edge.targetId === entity.id && edge.relationType === relationType);
              const edge = alreadyLinked ? [] : [{
                id: `${entityId}:${relationType}:${entity.id}`,
                sourceId: entityId,
                targetId: entity.id,
                relationType,
                source: entity.claims[0]?.source,
              }];
              if (existingCard || existingPin) {
                // El cruce: este nodo ya estaba en el corcho y ahora lo
                // sostiene un segundo fondo. Ahí la pregunta se vuelve
                // respuesta, y por eso el hallazgo sube a la tarjeta de caso.
                const nextEdges = [...graph.edges, ...edge];
                const holders = new Set(
                  nextEdges
                    .filter((item) => item.targetId === entity.id && item.relationType !== CASE_RELATION)
                    .map((item) => item.sourceId),
                );
                const names = [...holders]
                  .map((holderId) => graph.cards.find((card) => card.id === holderId)?.name)
                  .filter(Boolean);
                const finding = holders.size > 1
                  ? `${names.join(" y ")} coinciden en ${entity.name}.`
                  : graph.focus.finding;
                return {
                  researchCase: { ...graph, focus: { ...graph.focus, finding }, edges: nextEdges },
                  dedup: { ...state.dedup, [entity.id]: true },
                  toast: holders.size > 1 ? `Coincidencia: ${entity.name} ya estaba en el tablón.` : state.toast,
                };
              }
              const parent = graph.cards.find((card) => card.id === entityId);
              if (!parent) return state;
              return {
                researchCase: {
                  ...graph,
                  edges: [...graph.edges, ...edge],
                  pins: [...graph.pins, {
                    id: entity.id,
                    name: entity.name,
                    entityType: entity.entityType,
                    category: entity.category,
                    position: combPosition(
                      { x: parent.position.x + CARD_WIDTH / 2, y: parent.position.y + CARD_HEIGHT / 2 },
                      graph.focus.position,
                      // El filtro ya crece con cada chincheta añadida en este
                      // bucle; sumarle `index` saltaba de columna a mitad del tirón.
                      graph.pins.filter((item) => item.parentId === entityId).length,
                    ),
                    parentId: entityId,
                    relationType,
                    claims: entity.claims,
                  }],
                },
              };
            });
          }
          const dedupIds = Object.keys(get().dedup);
          if (dedupIds.length) {
            window.setTimeout(() => set({ dedup: {} }), 2400);
          }
        } catch (error) {
          set({ toast: error instanceof Error ? error.message : "Archivo saturado" });
        } finally {
          set((state) => ({ busy: { ...state.busy, [busyKey]: false } }));
        }
      },

      promotePin: async (id) => {
        if (get().busy[`promote:${id}`]) return;
        set((state) => ({ busy: { ...state.busy, [`promote:${id}`]: true }, toast: undefined }));
        try {
          const result = await apiJson<IntrospectionResponse>(`/api/entity/${encodeURIComponent(id)}/introspection`);
          set((state) => {
            if (!state.researchCase) return state;
            const pin = state.researchCase.pins.find((item) => item.id === id);
            if (!pin) return state;
            const card: EntityCard = {
              ...result.entity,
              category: result.entity.category ?? pin.category,
              position: pin.position,
              claims: result.entity.claims.length ? result.entity.claims : pin.claims ?? [],
              relations: result.relations,
            };
            return {
              selectedId: id,
              researchCase: {
                ...state.researchCase,
                pins: state.researchCase.pins.filter((item) => item.id !== id),
                cards: [...state.researchCase.cards, card],
              },
            };
          });
        } catch (error) {
          set({ toast: error instanceof Error ? error.message : "No se pudo abrir la ficha" });
        } finally {
          set((state) => ({ busy: { ...state.busy, [`promote:${id}`]: false } }));
        }
      },

      addReceipt: (receipt) => set((state) => ({
        inbox: [receipt, ...state.inbox.filter((item) => item.id !== receipt.id)].slice(0, 8),
      })),
      deliverDossier: (receiptId, dossier) => set((state) => ({
        inbox: state.inbox.map((receipt) => receipt.id === receiptId
          ? { ...receipt, state: "arrived", dossier, error: undefined }
          : receipt),
      })),
      failReceipt: (receiptId, error) => set((state) => ({
        inbox: state.inbox.map((receipt) => receipt.id === receiptId
          ? { ...receipt, state: "failed", error }
          : receipt),
      })),
      pinCandidate: (candidate) => set((state) => {
        if (!candidate.id || !state.researchCase) return { toast: "Esta candidata no tiene UUID fiable." };
        const graph = state.researchCase;
        const existing = graph.cards.find((card) => card.id === candidate.id) ?? graph.pins.find((pin) => pin.id === candidate.id);
        if (existing) {
          window.setTimeout(() => set({ dedup: {} }), 2400);
          return { selectedId: candidate.id, dedup: { ...state.dedup, [candidate.id]: true }, toast: "Coincidencia: ya estaba en el tablón." };
        }
        const anchor = graph.cards[0];
        if (!anchor) return state;
        return {
          researchCase: {
            ...graph,
            pins: [...graph.pins, {
              id: candidate.id,
              name: candidate.name,
              entityType: candidate.entityType ?? "Entity",
              category: candidate.category,
              position: combPosition(
                { x: anchor.position.x + CARD_WIDTH / 2, y: anchor.position.y + CARD_HEIGHT / 2 },
                graph.focus.position,
                graph.pins.filter((item) => item.parentId === anchor.id).length,
              ),
              parentId: anchor.id,
              relationType: "REPORT_MATCH",
              claims: candidate.claims,
            }],
            edges: [...graph.edges, {
              id: `report:${anchor.id}:${candidate.id}`,
              sourceId: anchor.id,
              targetId: candidate.id,
              relationType: "REPORT_MATCH",
              source: candidate.claims[0]?.source,
            }],
          },
        };
      }),
    }),
    {
      name: "signalgraph-board-v2",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        researchCase: state.researchCase,
        selector: state.selector,
        pan: state.pan,
        zoom: state.zoom,
        inbox: state.inbox,
      }),
    },
  ),
);
