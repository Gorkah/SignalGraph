import "server-only";

import { cacheFirst, readCache } from "@/lib/disk-cache";
import { claimsForEntity, entityById, getSeedPayload, loadCalaDumps } from "@/lib/seed";
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
const PROJECT_URL = process.env.CALA_PROJECT_URL;
const INTROSPECTION_URL = process.env.CALA_INTROSPECTION_URL;

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
  const apiKey = process.env.CALA_API_KEY;
  if (!apiKey) throw new CalaError("Falta CALA_API_KEY", "UPSTREAM_ERROR", 503);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new CalaError("El archivo tardó demasiado", "TIMEOUT", 504);
      }
      throw new CalaError(`No se pudo contactar con Cala: ${String(error)}`, "UPSTREAM_ERROR", 502);
    }

    if (response.status === 429) {
      if (attempt === 0) {
        await wait(2_000);
        continue;
      }
      throw new CalaError("Archivo saturado", "SATURATED", 503);
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
  throw new CalaError("Archivo saturado", "SATURATED", 503);
}

function normalize(value: string) {
  return value.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "");
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

const LOCAL_EDGES: Record<string, Record<string, string[]>> = {
  "dc60f800-f723-41b8-9482-810db28c9d70": {
    INVESTED_IN: ["eb86df55-d9fb-41bc-8104-ad6a892dc7ec"],
  },
  "4712a5e8-fa2e-4f27-9375-73b8fdbd3faf": {
    INVESTED_IN: ["81410730-336a-455d-aa77-1098b4fc9a23", "57dcbb4a-e060-42b3-9f16-d1b96372ef9b"],
  },
  "e3a596f9-cb53-454e-ac29-8bf2c69f1d67": {
    FINANCED: ["cac5c8eb-f483-428a-9ee1-0897ae037133"],
  },
};

function localProjection(entityId: string, relationType: string, limit: number): ProjectionResponse {
  const dumps = loadCalaDumps();
  const ids = (LOCAL_EDGES[entityId]?.[relationType] ?? []).slice(0, limit);
  const entities: ProjectionEntity[] = ids.flatMap((id) => {
    const entity = entityById(id, dumps);
    if (!entity) return [];
    return [{
      id: entity.id,
      name: entity.name,
      entityType: entity.entity_type,
      claims: claimsForEntity(entity, dumps),
    }];
  });
  return { entityId, relationType, source: "local-evidence", entities };
}

function normalizeProjection(raw: unknown, entityId: string, relationType: string, limit: number): ProjectionResponse {
  const payload = raw as { entities?: Array<Record<string, unknown>>; results?: Array<Record<string, unknown>> };
  const rows = payload.entities ?? payload.results;
  if (!Array.isArray(rows)) throw new CalaError("Proyección sin entidades", "UPSTREAM_ERROR", 502);
  const entities = rows.slice(0, limit).flatMap((row): ProjectionEntity[] => {
    const id = row.id;
    const name = row.name;
    if (typeof id !== "string" || typeof name !== "string") return [];
    return [{ id, name, entityType: typeof row.entity_type === "string" ? row.entity_type : "Entity", claims: [] }];
  });
  return { entityId, relationType, source: "live", entities };
}

export async function projectEntity(entityId: string, relationType: string, requestedLimit = 8) {
  const limit = Math.max(1, Math.min(8, Math.floor(requestedLimit)));
  const input = { entityId, relationType, limit };
  const cached = await readCache<ProjectionResponse>("projection", input);
  if (cached) return { ...cached, source: "disk" as const };

  if (!PROJECT_URL) {
    const { value } = await cacheFirst("projection", input, async () => localProjection(entityId, relationType, limit));
    return value;
  }

  const { value, hit } = await cacheFirst("projection", input, async () => {
    const raw = await fetchCala(PROJECT_URL, input, 30_000);
    return normalizeProjection(raw, entityId, relationType, limit);
  });
  return { ...value, source: hit ? "disk" as const : value.source };
}

export async function introspectEntity(entityId: string): Promise<IntrospectionResponse> {
  const input = { entityId };
  const cached = await readCache<IntrospectionResponse>("introspection", input);
  if (cached) return { ...cached, source: "disk" };

  if (!INTROSPECTION_URL) {
    const { value } = await cacheFirst("introspection", input, async () => {
      const dumps = loadCalaDumps();
      const entity = entityById(entityId, dumps);
      if (!entity) throw new CalaError("Entidad no encontrada", "NOT_FOUND", 404);
      const relationMap = LOCAL_EDGES[entityId] ?? {};
      return {
        entity: { id: entity.id, name: entity.name, entityType: entity.entity_type, claims: claimsForEntity(entity, dumps) },
        relations: Object.entries(relationMap).map(([type, ids]) => ({ type, count: ids.length })),
        source: "local-evidence" as const,
      };
    });
    return value;
  }

  const { value, hit } = await cacheFirst("introspection", input, async () => {
    const raw = await fetchCala(INTROSPECTION_URL, input, 30_000);
    const payload = raw as { entity?: Record<string, unknown>; relations?: Array<{ type: string; count: number }> };
    if (!payload.entity || typeof payload.entity.id !== "string" || typeof payload.entity.name !== "string") {
      throw new CalaError("Introspección inválida", "UPSTREAM_ERROR", 502);
    }
    return {
      entity: {
        id: payload.entity.id,
        name: payload.entity.name,
        entityType: typeof payload.entity.entity_type === "string" ? payload.entity.entity_type : "Entity",
        claims: [],
      },
      relations: Array.isArray(payload.relations) ? payload.relations : [],
      source: "live" as const,
    };
  });
  return { ...value, source: hit ? "disk" : value.source };
}
