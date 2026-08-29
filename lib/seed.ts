import "server-only";

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { occupiedBoxes, questionPositions } from "@/lib/geometry";
import { loadManifest, clientView } from "@/lib/manifest";
import { CASE_RELATION } from "@/lib/relations";
import { entityNameKey } from "@/lib/names";
import type {
  CalaEntity,
  CalaQueryDump,
  CalaResult,
  Claim,
  ClaimSource,
  CaseNode,
  Dossier,
  EntityCard,
  ResearchCase,
  SeedPayload,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data", "cala");
export const DEFAULT_REPORT_QUERY = "investors.location=Spain.sector=fintech";

const CENTRE = { x: 1100, y: 620 };

/**
 * Anillo de la investigación. Las posiciones ya no se escriben a mano: se
 * derivan del centro, para que el tablón siempre se lea como un caso con
 * un punto de origen y no como fichas sueltas.
 */
const RING_FALLBACK = [
  ["dc60f800-f723-41b8-9482-810db28c9d70", "DN Capital", "Venture capital"],
  ["d13f79c8-6698-4f4f-b98c-1a28d60d80b8", "Kibo Ventures", "Venture capital"],
  ["4712a5e8-fa2e-4f27-9375-73b8fdbd3faf", "K-Fund", "Venture capital"],
  ["e1bedcfd-ee74-4cb3-8059-d30de61462af", "Seaya Ventures", "Venture capital"],
  ["e3a596f9-cb53-454e-ac29-8bf2c69f1d67", "BBVA Spark Fund", "Growth finance"],
] as const;

const LABELS: Record<string, string> = {
  name: "Nombre",
  startup: "Nombre",
  city: "Ciudad",
  location: "Ubicación",
  focus: "Foco",
  description: "Descripción",
  notable_details: "Detalle",
  details: "Detalle",
  funding: "Financiación",
  notable_funding: "Financiación",
  total_key_round: "Ronda clave",
  sector: "Sector",
  type: "Tipo",
  founded_year: "Fundación",
  employees: "Equipo",
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  january: "01", february: "02", march: "03", april: "04", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function normalized(value: string) {
  return entityNameKey(value);
}

function principal(result: CalaResult) {
  const value = result.name ?? result.startup;
  return typeof value === "string" ? value : undefined;
}

function dateFromText(value: string) {
  const matches = [...value.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/gi)];
  const match = matches.at(-1);
  if (!match) return undefined;
  return `${match[2]}-${MONTHS[match[1].toLowerCase()]}-01`;
}

export function loadCalaDumps(): Array<{ file: string; dump: CalaQueryDump }> {
  return readdirSync(DATA_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      dump: JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8")) as CalaQueryDump,
    }))
    .filter(({ dump }) => dump.ok && dump.data);
}

function entityNames(entity: CalaEntity) {
  return [entity.name, ...(entity.mentions ?? [])];
}

let neighbourIndex: Map<string, CalaEntity> | undefined;

/**
 * Índice de todo lo alcanzable tirando de un hilo. Sin esto, cualquier entidad
 * que llegue de `data/relations` y no salga además en un dossier de query
 * revienta con "entidad no encontrada" al abrirla.
 */
function loadNeighbourIndex() {
  if (neighbourIndex) return neighbourIndex;
  neighbourIndex = new Map();
  for (const dump of loadRelations().values()) {
    for (const types of Object.values(dump.projection?.relationships ?? {})) {
      for (const items of Object.values(types)) {
        for (const item of items) {
          if (neighbourIndex.has(item.id)) continue;
          neighbourIndex.set(item.id, {
            id: item.id,
            name: item.name,
            entity_type: item.entity_type ?? "Entity",
            mentions: [item.name],
          });
        }
      }
    }
  }
  return neighbourIndex;
}

export function entityById(id: string, dumps = loadCalaDumps()) {
  for (const { dump } of dumps) {
    const entity = dump.data?.entities?.find((item) => item.id === id);
    if (entity) return entity;
  }
  return loadNeighbourIndex().get(id);
}

export function entityForName(name: string, dumps = loadCalaDumps()) {
  const key = normalized(name);
  for (const { dump } of dumps) {
    const entity = dump.data?.entities?.find((item) =>
      entityNames(item).some((mention) => normalized(mention) === key),
    );
    if (entity) return entity;
  }
  return undefined;
}

function resultMentionsEntity(result: CalaResult, entity: CalaEntity) {
  const direct = principal(result);
  if (direct && entityNames(entity).some((name) => normalized(name) === normalized(direct))) return true;
  const raw = JSON.stringify(result).toLocaleLowerCase("en");
  return entityNames(entity).some((name) => raw.includes(name.toLocaleLowerCase("en")));
}

function sourceFor(file: string, dump: CalaQueryDump): ClaimSource {
  return {
    label: "Cala query cache",
    query: dump.input,
    file: `data/cala/${file}`,
    runAt: dump.runAt,
  };
}

function claimsFromResult(result: CalaResult, source: ClaimSource, mention: boolean): Claim[] {
  return Object.entries(result).flatMap(([key, raw]) => {
    if (raw === null || raw === "" || key === "name" || key === "startup") return [];
    const value = String(raw);
    const claim: Claim = { key, label: LABELS[key] ?? key, value, date: dateFromText(value), source };
    return [mention ? { ...claim, mention: true as const } : claim];
  });
}

export function claimsForEntity(entity: CalaEntity, dumps = loadCalaDumps()) {
  const direct: Claim[] = [];
  const supporting: Claim[] = [];
  for (const { file, dump } of dumps) {
    for (const result of dump.data?.results ?? []) {
      if (!resultMentionsEntity(result, entity)) continue;
      const resultName = principal(result);
      const isDirect = Boolean(resultName && entityNames(entity).some((name) => normalized(name) === normalized(resultName)));
      const claims = claimsFromResult(result, sourceFor(file, dump), !isDirect);
      (isDirect ? direct : supporting).push(...claims);
    }
  }
  const seen = new Set<string>();
  return [...direct, ...supporting].filter((claim) => {
    const key = `${claim.key}:${claim.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const RELATIONS_DIR = path.join(process.cwd(), "data", "relations");

type RelationDump = {
  id: string;
  name: string;
  introspection?: { relationships?: { outgoing?: string[]; incoming?: string[] } };
  projection?: { relationships?: Record<string, Record<string, Array<{ id: string; name: string; entity_type?: string }>>> };
};

let relationCache: Map<string, RelationDump> | undefined;

/** Volcados de `scripts/pull-relations.mjs`. Sin ellos el tablón sigue en pie, solo que sin cabos. */
function loadRelations() {
  if (relationCache) return relationCache;
  relationCache = new Map();
  try {
    for (const file of readdirSync(RELATIONS_DIR)) {
      if (!file.endsWith(".json") || file.startsWith("_")) continue;
      const dump = JSON.parse(readFileSync(path.join(RELATIONS_DIR, file), "utf8")) as RelationDump;
      relationCache.set(dump.id, dump);
    }
  } catch {
    // Sin volcados no hay cabos; el caso se dibuja igual.
  }
  return relationCache;
}

/**
 * Vecinos reales de una entidad para un tipo de relación, deduplicados por
 * nombre: Cala devuelve la misma empresa con varios UUID (hay tres "Sesame"),
 * y sin esto el tablón la pinearía tres veces.
 */
export function relationNeighbours(entityId: string, relationType: string) {
  const dump = loadRelations().get(entityId);
  const seen = new Set<string>();
  const neighbours: Array<{ id: string; name: string; entityType: string }> = [];
  for (const types of Object.values(dump?.projection?.relationships ?? {})) {
    for (const [type, items] of Object.entries(types)) {
      if (type !== relationType) continue;
      for (const item of items) {
        const key = normalized(item.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        neighbours.push({ id: item.id, name: item.name, entityType: item.entity_type ?? "Entity" });
      }
    }
  }
  return neighbours;
}

export function relationsFor(id: string) {
  const dump = loadRelations().get(id);
  const counts = new Map<string, number>();
  for (const types of Object.values(dump?.projection?.relationships ?? {})) {
    for (const [type, items] of Object.entries(types)) {
      counts.set(type, (counts.get(type) ?? 0) + items.length);
    }
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

const CARD_W = 240;
const CARD_H = 176;
const GRID = 16;
const snapTo = (value: number) => Math.round(value / GRID) * GRID;

/** Centro del anillo → esquina superior izquierda de la ficha, pegada a la rejilla. */
function cardCorner(centreX: number, centreY: number) {
  return { x: snapTo(centreX - CARD_W / 2), y: snapTo(centreY - CARD_H / 2) };
}

const RING_RX = 660;
const RING_RY = 430;

function ringAngle(index: number, total: number) {
  return (index / total) * Math.PI * 2 - Math.PI / 2;
}

function ringCentre(index: number, total: number) {
  const angle = ringAngle(index, total);
  return { x: CENTRE.x + Math.cos(angle) * RING_RX, y: CENTRE.y + Math.sin(angle) * RING_RY };
}

/** Anillo del manifiesto si lo hay; si no, la semilla escrita a mano. */
function ringEntries(manifest: ReturnType<typeof loadManifest>) {
  if (manifest?.ring?.length) {
    return manifest.ring.map((entry) => [entry.id, entry.name, entry.subtitle] as const);
  }
  return RING_FALLBACK.map(([id, name, category]) => [id, name, category] as const);
}

function buildCards(dumps: ReturnType<typeof loadCalaDumps>, manifest: ReturnType<typeof loadManifest>): EntityCard[] {
  const RING = ringEntries(manifest);
  const cards: EntityCard[] = [];
  const centres = new Map<string, { x: number; y: number }>();

  RING.forEach(([id, fallbackName, category], index) => {
    const entity = entityById(id, dumps);
    const centre = ringCentre(index, RING.length);
    centres.set(id, centre);
    cards.push({
      id,
      name: entity?.name || fallbackName,
      entityType: entity?.entity_type ?? "Organization",
      category,
      position: cardCorner(centre.x, centre.y),
      claims: entity ? claimsForEntity(entity, dumps) : [],
      relations: relationsFor(id),
      density: "full",
    });
  });

  return cards;
}

function buildCase(dumps: ReturnType<typeof loadCalaDumps>, manifest: ReturnType<typeof loadManifest>): ResearchCase {
  const RING = ringEntries(manifest);
  const focus: CaseNode = {
    id: "case-root",
    title: manifest?.question ?? "¿Se reparten el fintech español entre los mismos fondos?",
    query: manifest?.query ?? DEFAULT_REPORT_QUERY,
    position: { x: snapTo(CENTRE.x - 148), y: snapTo(CENTRE.y - 92) },
  };

  // Hilo fino del caso a cada ficha del anillo: nadie está en el corcho por casualidad.
  const caseEdges = RING.map(([id]) => ({
    id: `case-${id}`,
    sourceId: focus.id,
    targetId: id,
    relationType: CASE_RELATION,
  }));

  const cards = buildCards(dumps, manifest);
  const edges = [...caseEdges];
  // Las preguntas cuelgan del caso, en fila bajo su tarjeta, y se corren solas
  // al hueco libre más cercano si el anillo ya ocupa ese sitio. El agente
  // decide qué preguntar, no coordenadas: esa frontera sigue intacta, y el
  // manifiesto puede cambiar el anillo entero sin dejarlas encima de una ficha.
  const asked = (manifest?.questions ?? []).slice(0, 2);
  const slots = questionPositions(focus.position, asked.length, occupiedBoxes({ focus, cards }));
  const questions = asked.map((question, index) => ({
    ...question,
    state: "open" as const,
    position: slots[index],
  }));

  // El id sale del contenido: si cambia la semilla o el layout, el tablón
  // guardado en localStorage deja de coincidir y se regenera solo. Sin esto,
  // cualquier ajuste de posición queda invisible tras el primer render.
  const signature = createHash("sha1")
    .update(JSON.stringify([
      focus.position,
      cards.map((c) => [c.id, c.position]),
      edges.map((e) => e.id),
      questions.map((q) => [q.id, q.prompt, q.position]),
      manifest?.story,
      manifest?.ui,
    ]))
    .digest("hex")
    .slice(0, 8);

  return {
    id: `cala-case-${signature}`,
    title: manifest?.subtitle ?? "Caso · el reparto del fintech español",
    focus,
    cards,
    edges,
    questions,
  };
}

function buildFallbackDossier(dumps: ReturnType<typeof loadCalaDumps>, query: string): Dossier {
  const entry = dumps.find(({ dump }) => dump.input === query)
    ?? dumps.find(({ dump }) => dump.input === DEFAULT_REPORT_QUERY);
  if (!entry) throw new Error(`Fallback dossier missing for ${query}`);
  const candidates = (entry.dump.data?.results ?? []).map((result) => {
    const name = principal(result) ?? "Entidad sin nombre";
    const entity = entityForName(name, [entry]);
    return {
      id: entity?.id,
      name,
      entityType: entity?.entity_type,
      category: typeof result.focus === "string" ? result.focus : undefined,
      claims: claimsFromResult(result, sourceFor(entry.file, entry.dump), false),
    };
  });
  return {
    id: `fallback-${entry.dump.runAt}`,
    query: entry.dump.input,
    title: "Dossier local · fintech España",
    deliveredAt: entry.dump.runAt,
    source: "fallback",
    candidates,
  };
}

export function getSeedPayload(caseSlug?: string): SeedPayload {
  const dumps = loadCalaDumps();
  const manifest = loadManifest(caseSlug);
  const reportQuery = manifest?.query ?? DEFAULT_REPORT_QUERY;
  return {
    caseView: clientView(manifest),
    researchCase: buildCase(dumps, manifest),
    fallbackDossier: buildFallbackDossier(dumps, reportQuery),
    defaultReportQuery: reportQuery,
  };
}
