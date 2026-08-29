import "server-only";

import { cacheFirst, readCache } from "@/lib/disk-cache";
import { loadManifest } from "@/lib/manifest";
import { entityNameKey } from "@/lib/names";
import { claimsForEntity, entityById, getSeedPayload, loadCalaDumps, relationNeighbours, relationsFor } from "@/lib/seed";
import type {
  ApiErrorCode,
  CalaEntity,
  CalaResult,
  Claim,
  Dossier,
  DossierCandidate,
  IntrospectionResponse,
  ProjectionEntity,
  ProjectionResponse,
} from "@/lib/types";

const QUERY_URL = process.env.CALA_API_URL ?? "https://api.cala.ai/v1/knowledge/query";
const ENTITY_BASE = process.env.CALA_ENTITY_URL ?? "https://api.cala.ai/v1/entities";
/** Con esto a "0" el tablón no sale a la red: solo caché de disco y volcados. */
const LIVE = process.env.CALA_LIVE !== "0";

export class CalaError extends Error {
  constructor(
    message: string,
    public code: ApiErrorCode,
    public status: number,
  ) {
    super(message);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCala(url: string, body: unknown, timeoutMs: number) {
  const method = body === undefined ? "GET" : "POST";
  const apiKey = process.env.CALA_API_KEY;
  if (!apiKey) throw new CalaError("Falta CALA_API_KEY", "UPSTREAM_ERROR", 503);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new CalaError("Cala tardó demasiado", "TIMEOUT", 504);
      }
      throw new CalaError(`No se pudo contactar con Cala: ${String(error)}`, "UPSTREAM_ERROR", 502);
    }

    if (response.status === 429) {
      if (attempt === 0) {
        await wait(2_000);
        continue;
      }
      throw new CalaError("Cala está saturada", "SATURATED", 503);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new CalaError(`Cala respondió ${response.status}: ${text.slice(0, 240)}`, "UPSTREAM_ERROR", 502);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new CalaError("Cala devolvió una respuesta inválida", "UPSTREAM_ERROR", 502);
    }
  }
  throw new CalaError("Cala está saturada", "SATURATED", 503);
}

function normalize(value: string) {
  return entityNameKey(value);
}

function principal(result: CalaResult) {
  const value = result.name ?? result.startup;
  return typeof value === "string" ? value : "Entidad sin nombre";
}

function entityForResult(name: string, entities: CalaEntity[]) {
  const target = normalize(name);
  return entities.find((entity) =>
    [entity.name, ...(entity.mentions ?? [])].some((mention) => normalize(mention) === target),
  );
}

function claimsFromLiveResult(result: CalaResult, query: string, runAt: string): Claim[] {
  return Object.entries(result).flatMap(([key, raw]) => {
    if (raw === null || raw === "" || key === "name" || key === "startup") return [];
    return [{
      key,
      label: key.replaceAll("_", " "),
      value: String(raw),
      source: { label: "Cala live query", query, file: "live response", runAt },
    }];
  });
}

function dossierFromData(input: string, data: unknown): Dossier {
  const payload = data as { results?: CalaResult[]; entities?: CalaEntity[] };
  if (!Array.isArray(payload.results) || !Array.isArray(payload.entities)) {
    throw new CalaError("La respuesta no contiene results/entities", "UPSTREAM_ERROR", 502);
  }
  const deliveredAt = new Date().toISOString();
  const candidates: DossierCandidate[] = payload.results.map((result) => {
    const name = principal(result);
    const entity = entityForResult(name, payload.entities ?? []);
    return {
      id: entity?.id,
      name,
      entityType: entity?.entity_type,
      category: typeof result.sector === "string" ? result.sector : typeof result.focus === "string" ? result.focus : undefined,
      claims: claimsFromLiveResult(result, input, deliveredAt),
    };
  });
  return {
    id: `live-${Date.now()}`,
    query: input,
    title: `Dossier · ${input}`,
    deliveredAt,
    source: "live",
    candidates,
  };
}

export async function queryDossier(input: string, options: { timeoutMs?: number; forceLive?: boolean } = {}) {
  const normalizedInput = input.trim();
  if (!normalizedInput || normalizedInput.length > 240) {
    throw new CalaError("La consulta no es válida", "BAD_REQUEST", 400);
  }

  if (!options.forceLive) {
    const disk = getSeedPayload().fallbackDossier;
    if (disk.query === normalizedInput) return { ...disk, source: "disk" as const };
  }

  const { value, hit } = await cacheFirst("report", { input: normalizedInput }, async () => {
    const raw = await fetchCala(QUERY_URL, { input: normalizedInput }, options.timeoutMs ?? 120_000);
    const body = raw as { data?: unknown };
    return dossierFromData(normalizedInput, body.data ?? raw);
  });
  return { ...value, source: hit ? "disk" as const : "live" as const };
}

/**
 * Tirar de un hilo se resuelve contra `data/relations`, que trajo
 * `scripts/pull-relations.mjs`. Cero llamadas en vivo y datos reales: el
 * ensayo paga, la demo cobra.
 */
function localProjection(entityId: string, relationType: string, limit: number): ProjectionResponse {
  const dumps = loadCalaDumps();
  const entities: ProjectionEntity[] = relationNeighbours(entityId, relationType)
    .slice(0, limit)
    .map((neighbour) => {
      const known = entityById(neighbour.id, dumps);
      return {
        id: neighbour.id,
        name: neighbour.name,
        entityType: neighbour.entityType,
        claims: known ? claimsForEntity(known, dumps) : [],
      };
    });
  return { entityId, relationType, source: "local-evidence", entities };
}

type CalaNeighbour = { id?: unknown; name?: unknown; entity_type?: unknown };

/** Aplana `{outgoing: {TIPO: [...]}, incoming: {...}}` a una lista de vecinos. */
function flattenRelationships(raw: unknown, relationType: string, limit: number): ProjectionEntity[] {
  const payload = raw as { relationships?: Record<string, Record<string, CalaNeighbour[]>> };
  const seen = new Set<string>();
  const entities: ProjectionEntity[] = [];
  for (const types of Object.values(payload.relationships ?? {})) {
    for (const [type, items] of Object.entries(types ?? {})) {
      if (type !== relationType || !Array.isArray(items)) continue;
      for (const item of items) {
        if (typeof item?.id !== "string" || typeof item?.name !== "string") continue;
        // Cala devuelve la misma empresa bajo varios UUID; deduplicar por
        // nombre evita clavarla tres veces en el tablón.
        const key = normalize(item.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        entities.push({
          id: item.id,
          name: item.name,
          entityType: typeof item.entity_type === "string" ? item.entity_type : "Entity",
          claims: [],
        });
        if (entities.length >= limit) return entities;
      }
    }
  }
  return entities;
}

/**
 * Tirar de un hilo, en tres escalones: caché de disco, volcados de
 * `data/relations` y, solo si no hay nada, la API real. El camino ensayado es
 * instantáneo y sobrevive sin red; lo que se salga de él sigue funcionando.
 */
export async function projectEntity(entityId: string, relationType: string, requestedLimit = 5) {
  // Una ficha normal sigue pidiendo cinco. Las preguntas de archivo pueden
  // inspeccionar hasta veinte para seleccionar las cinco evidencias que el
  // manifiesto declaró relevantes sin depender del orden del hub.
  const limit = Math.max(1, Math.min(20, Math.floor(requestedLimit)));
  const input = { entityId, relationType, limit };
  const cached = await readCache<ProjectionResponse>("projection", input);
  if (cached) return { ...cached, source: "disk" as const };

  const local = localProjection(entityId, relationType, limit);
  if (local.entities.length) {
    const { value } = await cacheFirst("projection", input, async () => local);
    return value;
  }
  if (!LIVE) return local;

  const { value, hit } = await cacheFirst("projection", input, async () => {
    const raw = await fetchCala(`${ENTITY_BASE}/${encodeURIComponent(entityId)}`, {
      properties: ["name", "description"],
      relationships: {
        outgoing: { [relationType]: { limit: limit * 3 } },
        incoming: { [relationType]: { limit: limit * 3 } },
      },
    }, 30_000);
    return {
      entityId,
      relationType,
      source: "live" as const,
      entities: flattenRelationships(raw, relationType, limit),
    };
  });
  return { ...value, source: hit ? "disk" as const : value.source };
}

type PropertyValue = {
  value?: unknown;
  sources?: Array<{ name?: string; document?: string; date?: string }>;
};

/**
 * Qué propiedades vale la pena pedirle a una entidad recién abierta.
 *
 * La introspección dice cuáles EXISTEN y el manifiesto del caso cuáles
 * IMPORTAN —son las que van en portada y al dorso—, así que se pide solo la
 * intersección: ni un campo de más, y ninguno inventado. Sin manifiesto queda
 * lo que describe a cualquier cosa.
 */
function askedFields() {
  const manifest = loadManifest();
  return [...new Set([
    "description",
    ...(manifest?.cover ?? []).flatMap((slot) => slot.fields),
    ...(manifest?.back?.fields ?? []),
  ])];
}

function wantedProperties(available: string[]) {
  const offer = new Set(available);
  const wanted = askedFields().filter((field) => offer.has(field));
  return wanted.length ? wanted.slice(0, 10) : ["description"];
}

function humanKey(key: string) {
  return key.replace(/_/g, " ");
}

/** Un valor de propiedad puede llegar como lista ("aliases") o como número. */
function plainValue(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map(plainValue).filter(Boolean).join(", ");
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "object") return "";
  return String(raw).trim();
}

/**
 * Las propiedades de la entidad, convertidas en claims con su procedencia
 * real: Cala devuelve para cada una las fuentes de las que la sacó, así que la
 * ficha puede decir de dónde viene cada renglón sin inventarse el origen.
 */
function claimsFromProperties(raw: unknown): Claim[] {
  const payload = raw as { description?: string; properties?: Record<string, PropertyValue> };
  const entries = Object.entries(payload.properties ?? {});
  const claims: Claim[] = [];
  for (const [key, property] of entries) {
    if (key === "name" || key === "id") continue;
    const value = plainValue(property?.value);
    if (!value) continue;
    const origin = property?.sources?.[0];
    claims.push({
      key,
      label: humanKey(key),
      value,
      source: {
        label: origin?.name ?? "Cala · entidad",
        query: `propiedades de la entidad`,
        file: "api.cala.ai/v1/entities",
        runAt: origin?.date ?? new Date().toISOString().slice(0, 10),
        url: origin?.document,
      },
    });
  }
  if (!claims.some((claim) => claim.key === "description") && payload.description?.trim()) {
    claims.unshift({
      key: "description",
      label: "description",
      value: payload.description.trim(),
      source: {
        label: "Cala · entidad",
        query: "propiedades de la entidad",
        file: "api.cala.ai/v1/entities",
        runAt: new Date().toISOString().slice(0, 10),
      },
    });
  }
  return claims;
}

export async function introspectEntity(entityId: string): Promise<IntrospectionResponse> {
  // Los campos entran en la clave: si el manifiesto cambia lo que quiere en
  // portada, la caché de ayer ya no sirve para la ficha de hoy.
  const input = { entityId, fields: askedFields() };
  const cached = await readCache<IntrospectionResponse>("introspection", input);
  if (cached) return { ...cached, source: "disk" };

  const dumps = loadCalaDumps();
  const known = entityById(entityId, dumps);
  const localRelations = relationsFor(entityId);
  const entity: ProjectionEntity = known
    ? { id: known.id, name: known.name, entityType: known.entity_type, claims: claimsForEntity(known, dumps) }
    : { id: entityId, name: "", entityType: "Entity", claims: [] };

  if (localRelations.length) {
    const { value } = await cacheFirst("introspection", input, async () => ({
      entity, relations: localRelations, source: "local-evidence" as const,
    }));
    return value;
  }
  if (!LIVE) return { entity, relations: [], source: "local-evidence" };

  const { value, hit } = await cacheFirst("introspection", input, async () => {
    const raw = await fetchCala(`${ENTITY_BASE}/${encodeURIComponent(entityId)}/introspection`, undefined, 20_000);
    const payload = raw as {
      properties?: string[];
      relationships?: { outgoing?: string[]; incoming?: string[] };
    };
    // La introspección lista los tipos disponibles pero no cuántos hay: el
    // número solo aparece al proyectar, así que el cabo va sin contador.
    const types = [...new Set([
      ...(payload.relationships?.outgoing ?? []),
      ...(payload.relationships?.incoming ?? []),
    ])];
    // Una ficha que se abre sin nada que decir no es un expediente. Si el
    // dossier local no sabía de ella, se le piden a Cala sus propiedades: la
    // introspección acaba de decir cuáles tiene y el manifiesto cuáles pinta.
    const claims = entity.claims.length
      ? entity.claims
      : await fetchCala(`${ENTITY_BASE}/${encodeURIComponent(entityId)}`, {
        properties: wantedProperties(payload.properties ?? []),
      }, 30_000).then(claimsFromProperties).catch(() => []);
    return {
      entity: { ...entity, claims },
      relations: types.map((type) => ({ type })),
      source: "live" as const,
    };
  });
  return { ...value, source: hit ? "disk" : value.source };
}
