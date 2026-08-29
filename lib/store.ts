"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CARD_HEIGHT, CARD_WIDTH, combPosition, snapPoint } from "@/lib/geometry";
import { CASE_RELATION, relationNoun, registerNouns } from "@/lib/relations";
import type {
  CaseView,
  Dossier,
  DossierCandidate,
  InboxReceipt,
  IntrospectionResponse,
  Point,
  ProjectionResponse,
  ResearchCase,
} from "@/lib/types";

type BoardState = {
  researchCase: ResearchCase | null;
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
  setPan: (pan: Point) => void;
  setZoom: (zoom: number, anchor?: Point) => void;
  setView: (view: { pan: Point; zoom: number }) => void;
  framedCaseId?: string;
  moveNode: (id: string, point: Point) => void;
  selectNode: (id?: string) => void;
  pullRelation: (entityId: string, relationType: string) => Promise<void>;
  openCard: (id: string) => Promise<void>;
  toggleStack: (stackId: string) => void;
  expandedStacks: string[];
  caseView?: CaseView;
  setCaseView: (view?: CaseView) => void;
  addReceipt: (receipt: InboxReceipt) => void;
  deliverDossier: (receiptId: string, dossier: Dossier) => void;
  failReceipt: (receiptId: string, error: string) => void;
  pinCandidate: (candidate: DossierCandidate) => void;
  setToast: (toast?: string) => void;
};

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Misma normalización que la capa de datos (`normalized` en lib/seed.ts,
 * `normalize` en lib/cala.ts). Cala fragmenta una misma empresa en varios
 * UUID —hay tres "Sesame"—, así que el nombre normalizado es lo único que la
 * identifica de verdad; el id sigue siendo la identidad del tablón.
 */
const nameKey = (value: string) => value.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "");
const sameName = (a: string, b: string) => nameKey(a) === nameKey(b);

/** "por Seaya Ventures y por BBVA Spark Fund"; con más de dos, comas. */
function eachOf(names: string[], preposition: string) {
  const parts = names.map((name) => `${preposition} ${name}`);
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

// El cruce se anuncia como hallazgo, no como mecánica: la demo tira de
// `inversión`, pero cualquier cabo improvisado tiene que sonar a frase.
const CROSS_PHRASE: Record<string, { verb: string; preposition: string }> = {
  INVESTED_IN: { verb: "financiada", preposition: "por" },
  FINANCED: { verb: "financiada", preposition: "por" },
};

function crossToast(name: string, holders: string[], relationType: string) {
  const phrase = CROSS_PHRASE[relationType]
    ?? { verb: `${relationNoun(relationType)} en común`, preposition: "con" };
  return `${name} — ${phrase.verb} ${eachOf(holders, phrase.preposition)}`;
}

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
      pan: { x: 40, y: 24 },
      zoom: 1,
      inbox: [],
      hydrated: false,
      busy: {},
      dedup: {},
      expandedStacks: [],

      initialize: (researchCase) => set((state) => ({
        researchCase: state.researchCase?.id === researchCase.id ? state.researchCase : researchCase,
      })),
      finishHydration: () => set({ hydrated: true }),
      // El resaltado del reencuentro no caduca solo: vive hasta el siguiente
      // gesto del usuario sobre el caso —tirar de un cabo, abrir una ficha,
      // seleccionar, desplegar un mazo—, que es lo que lo apaga. Encuadrar
      // (pan, zoom, arrastrar una ficha) no lo mata: se puede recorrer el
      // cruce mientras se cuenta. Hojear una ficha tampoco: la portada y el
      // dorso son lectura, y viven dentro del propio componente.
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
      setCaseView: (caseView) => {
        registerNouns(caseView?.nouns);
        set({ caseView });
      },
      toggleStack: (stackId) => set((state) => ({
        dedup: {},
        expandedStacks: state.expandedStacks.includes(stackId)
          ? state.expandedStacks.filter((item) => item !== stackId)
          : [...state.expandedStacks, stackId],
      })),
      selectNode: (selectedId) => set({ selectedId, dedup: {} }),
      moveNode: (id, point) => set((state) => {
        if (!state.researchCase) return state;
        const position = snapPoint(point);
        return {
          researchCase: {
            ...state.researchCase,
            cards: state.researchCase.cards.map((card) => card.id === id ? { ...card, position } : card),
            focus: state.researchCase.focus.id === id
              ? { ...state.researchCase.focus, position }
              : state.researchCase.focus,
          },
        };
      }),

      pullRelation: async (entityId, relationType) => {
        const busyKey = `${entityId}:${relationType}`;
        if (get().busy[busyKey]) return;
        set((state) => ({ busy: { ...state.busy, [busyKey]: true }, toast: undefined, dedup: {} }));
        try {
          const projection = await apiJson<ProjectionResponse>(`/api/entity/${encodeURIComponent(entityId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projection: relationType, limit: 5 }),
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
              // El reencuentro se empareja por nombre normalizado, como la capa
              // de datos: por UUID solo salía cuando las dos carteras traían el
              // mismo id, y una participada compartida con id distinto se
              // clavaba dos veces desmintiendo la tesis en pantalla.
              const existingCard = graph.cards.find((card) => sameName(card.name, entity.name));
              // La identidad del tablón sigue siendo el id: el hilo se ata a la
              // ficha ya clavada, no al UUID recién llegado.
              const targetId = existingCard?.id ?? entity.id;
              // Un cabo que vuelve al propio fondo (otra grafía de su nombre)
              // no es cruce ni hilo.
              if (targetId === entityId) return state;
              const alreadyLinked = graph.edges.some((edge) => edge.sourceId === entityId && edge.targetId === targetId && edge.relationType === relationType);
              const edge = alreadyLinked ? [] : [{
                id: `${entityId}:${relationType}:${targetId}`,
                sourceId: entityId,
                targetId,
                relationType,
                source: entity.claims[0]?.source,
              }];
              if (existingCard) {
                // El cruce: este nodo ya estaba en el corcho y ahora lo
                // sostiene un segundo fondo. Ahí la pregunta se vuelve
                // respuesta, y por eso el hallazgo sube a la tarjeta de caso.
                const nextEdges = [...graph.edges, ...edge];
                const holders = new Set(
                  nextEdges
                    .filter((item) => item.targetId === targetId && item.relationType !== CASE_RELATION)
                    .map((item) => item.sourceId),
                );
                const names = [...holders]
                  .map((holderId) => graph.cards.find((card) => card.id === holderId)?.name)
                  .filter((name): name is string => Boolean(name));
                // Hay cruce cuando la sostienen dos manos distintas; volver a
                // tirar del mismo fondo no resalta media cartera.
                const crossed = holders.size > 1;
                // El hallazgo se redacta con la plantilla que decidió el
                // agente para este caso, no con una frase de financiación.
                const view = state.caseView;
                const fill = (tpl: string) => tpl
                  .replace("{holders}", names.join(" y "))
                  .replace("{target}", existingCard.name);
                const finding = crossed
                  ? fill(view?.finding.template ?? "{holders} coinciden en {target}.")
                  : graph.focus.finding;
                // Si la reencontrada seguía dentro de un mazo cerrado, el
                // mazo se abre: un resaltado que nadie ve no es un clímax.
                const crossedStack = existingCard.stackId;
                const expandedStacks = crossed && crossedStack && !state.expandedStacks.includes(crossedStack)
                  ? [...state.expandedStacks, crossedStack]
                  : state.expandedStacks;
                return {
                  expandedStacks,
                  researchCase: { ...graph, focus: { ...graph.focus, finding }, edges: nextEdges },
                  dedup: crossed ? { ...state.dedup, [existingCard.id]: true } : state.dedup,
                  // El aviso cuenta el hallazgo con nombres, no la mecánica.
                  toast: crossed
                    ? (view?.finding.toast
                        ? fill(view.finding.toast)
                        : crossToast(existingCard.name, names, relationType))
                    : state.toast,
                };
              }
              const parent = graph.cards.find((card) => card.id === entityId);
              if (!parent) return state;
              const stackId = `${entityId}:${relationType}`;
              return {
                researchCase: {
                  ...graph,
                  edges: [...graph.edges, ...edge],
                  cards: [...graph.cards, {
                    id: entity.id,
                    name: entity.name,
                    entityType: entity.entityType,
                    category: entity.category,
                    position: combPosition(
                      { x: parent.position.x + CARD_WIDTH / 2, y: parent.position.y + CARD_HEIGHT / 2 },
                      graph.focus.position,
                      // El filtro ya crece con cada pista añadida en este bucle;
                      // sumarle `index` saltaba de columna a mitad del tirón.
                      graph.cards.filter((item) => item.stackId === stackId).length,
                    ),
                    claims: entity.claims,
                    relations: [],
                    density: "lead" as const,
                    parentId: entityId,
                    relationType,
                    stackId,
                  }],
                },
              };
            });
          }
        } catch (error) {
          set({ toast: error instanceof Error ? error.message : "Archivo saturado" });
        } finally {
          set((state) => ({ busy: { ...state.busy, [busyKey]: false } }));
        }
      },

      openCard: async (id) => {
        if (get().busy[`open:${id}`]) return;
        set((state) => ({ busy: { ...state.busy, [`open:${id}`]: true }, toast: undefined, dedup: {} }));
        try {
          const result = await apiJson<IntrospectionResponse>(`/api/entity/${encodeURIComponent(id)}/introspection`);
          set((state) => {
            if (!state.researchCase) return state;
            return {
              selectedId: id,
              researchCase: {
                ...state.researchCase,
                cards: state.researchCase.cards.map((card) => card.id !== id ? card : {
                  ...card,
                  density: "full" as const,
                  category: result.entity.category ?? card.category,
                  claims: result.entity.claims.length ? result.entity.claims : card.claims,
                  relations: result.relations,
                }),
              },
            };
          });
        } catch (error) {
          set({ toast: error instanceof Error ? error.message : "No se pudo abrir la ficha" });
        } finally {
          set((state) => ({ busy: { ...state.busy, [`open:${id}`]: false } }));
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
        if (!state.researchCase) return state;
        const graph = state.researchCase;
        // Misma política que el tirón de cabo: por nombre, no por UUID.
        const existing = graph.cards.find((card) => sameName(card.name, candidate.name));
        if (existing) {
          return {
            selectedId: existing.id,
            dedup: { [existing.id]: true },
            toast: `${existing.name} — el dossier apunta a una ficha que ya estaba en el tablón.`,
          };
        }
        if (!candidate.id) return { toast: "Esta candidata no tiene UUID fiable." };
        const anchor = graph.cards[0];
        if (!anchor) return state;
        return {
          dedup: {},
          researchCase: {
            ...graph,
            cards: [...graph.cards, {
              id: candidate.id,
              name: candidate.name,
              entityType: candidate.entityType ?? "Entity",
              category: candidate.category,
              position: combPosition(
                { x: anchor.position.x + CARD_WIDTH / 2, y: anchor.position.y + CARD_HEIGHT / 2 },
                graph.focus.position,
                graph.cards.filter((item) => item.stackId === `${anchor.id}:REPORT_MATCH`).length,
              ),
              claims: candidate.claims,
              relations: [],
              density: "lead" as const,
              parentId: anchor.id,
              relationType: "REPORT_MATCH",
              stackId: `${anchor.id}:REPORT_MATCH`,
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
        pan: state.pan,
        zoom: state.zoom,
        inbox: state.inbox,
      }),
    },
  ),
);
