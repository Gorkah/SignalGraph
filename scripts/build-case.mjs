#!/usr/bin/env node
/**
 * Agente de caso: convierte una pregunta en un manifiesto de tablón.
 *
 *   node --env-file=.env scripts/build-case.mjs "investors.location=Spain.sector=fintech"
 *
 * El agente investiga de verdad —pregunta al archivo, elige de quién tirar,
 * baja relaciones y busca cruces— y devuelve el JSON que configura el tablón.
 * Nunca devuelve coordenadas: la geometría es determinista y vive en el código.
 * Las instrucciones y el contrato están en `scripts/case-agent.md`.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { ToolLoopAgent, Output, isStepCount, tool } from "ai";
import { z } from "zod";

const CALA = "https://api.cala.ai/v1";
const CACHE = "data/cache";
const OUT = "data/cases";

// Cala corta sobre las diez llamadas seguidas. El agente tiene que elegir a
// quién interroga en vez de recorrer el grafo a lo ancho, así que el límite
// es explícito y se le cuenta en cada respuesta.
const BUDGET = Number(process.env.CASE_BUDGET ?? 24);
let spent = 0;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (op, input) => createHash("sha256").update(`${op}:${JSON.stringify(input)}`).digest("hex");

async function cala(op, urlPath, body, timeout = 90_000) {
  const cacheFile = path.join(CACHE, `agent-${op}-${key(op, { urlPath, body })}.json`);
  if (existsSync(cacheFile)) return { ...JSON.parse(await readFile(cacheFile, "utf8")), _cache: "hit" };

  if (spent >= BUDGET) {
    return { error: `Presupuesto agotado (${BUDGET} llamadas). Trabajá con lo que ya tenés.` };
  }
  spent += 1;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await wait(4000 * attempt);
    const res = await fetch(`${CALA}${urlPath}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": process.env.CALA_API_KEY },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    if (res.status === 429) continue;
    if (!res.ok) return { error: `Cala respondió ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const data = await res.json();
    await mkdir(CACHE, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(data, null, 2));
    return data;
  }
  return { error: "Cala saturado tras 3 intentos." };
}

const restante = () => `\n[quedan ${Math.max(0, BUDGET - spent)} llamadas de ${BUDGET}]`;
const responder = (data) => JSON.stringify(data).slice(0, 12_000) + restante();

/** Las cinco herramientas calcan los endpoints reales de Cala. */
const tools = {
  knowledge_query: tool({
    description:
      "Lista estructurada de entidades para un filtro. Acepta lenguaje natural o notación con puntos " +
      "(`startups.location=Spain.funding>10M`). TARDA HASTA 90 SEGUNDOS: usala pocas veces y con criterio.",
    inputSchema: z.object({ input: z.string().describe("La consulta al archivo") }),
    execute: async ({ input }) => responder(await cala("query", "/knowledge/query", { input })),
  }),
  knowledge_search: tool({
    description: "Respuesta en prosa con fuentes citadas a una pregunta. Misma entrada que knowledge_query, otra salida. También lenta.",
    inputSchema: z.object({ input: z.string() }),
    execute: async ({ input }) => responder(await cala("search", "/knowledge/search", { input })),
  }),
  entity_search: tool({
    description: "Busca entidades por nombre (difuso) y devuelve sus UUID. Rápida. Usala cuando conocés el nombre pero no el id.",
    inputSchema: z.object({
      name: z.string(),
      entity_types: z.array(z.string()).nullish().describe("Filtro opcional, p. ej. ['Organization']"),
    }),
    execute: async ({ name, entity_types }) => {
      const qs = new URLSearchParams({ name });
      for (const t of entity_types ?? []) qs.append("entity_types", t);
      return responder(await cala("entsearch", `/entities?${qs}`, undefined, 30_000));
    },
  }),
  entity_introspection: tool({
    description: "Qué propiedades y relaciones tiene una entidad, ANTES de pedirlas. Rápida y barata: usala para decidir si merece la pena tirar del hilo.",
    inputSchema: z.object({ entity_id: z.string().describe("UUID de la entidad") }),
    execute: async ({ entity_id }) => responder(await cala("intro", `/entities/${entity_id}/introspection`, undefined, 30_000)),
  }),
  retrieve_entity: tool({
    description:
      "Datos de una entidad con sus relaciones. Pedí solo lo que vas a usar: `relationships` es un objeto " +
      "{outgoing:{TIPO:{limit}}, incoming:{...}}. Es la única forma de ver vecinos, y con la que se detectan los cruces.",
    inputSchema: z.object({
      entity_id: z.string(),
      properties: z.array(z.string()).optional(),
      outgoing: z.array(z.string()).optional().describe("Tipos de relación salientes"),
      incoming: z.array(z.string()).optional().describe("Tipos de relación entrantes"),
      limit: z.number().optional().default(20),
    }),
    execute: async ({ entity_id, properties, outgoing, incoming, limit }) => {
      const rel = {};
      if (outgoing?.length) rel.outgoing = Object.fromEntries(outgoing.map((t) => [t, { limit }]));
      if (incoming?.length) rel.incoming = Object.fromEntries(incoming.map((t) => [t, { limit }]));
      return responder(await cala("proj", `/entities/${entity_id}`, {
        properties: properties ?? ["name", "description"],
        ...(Object.keys(rel).length ? { relationships: rel } : {}),
      }, 45_000));
    },
  }),
};

const manifest = z.object({
  question: z.string().describe("La pregunta del caso, en español, para leer en una tarjeta"),
  subtitle: z.string().describe("Una línea que sitúa el caso"),
  openVerb: z.object({
    relation: z.string().describe("Tipo de relación que significa 'abrir' una ficha, p. ej. INVESTED_IN"),
    label: z.string().describe("Cómo lo llama la interfaz: cartera, expediente, entorno…"),
    noun: z.string().describe("Sustantivo simétrico del hilo, p. ej. inversión"),
    hidden: z.boolean().optional().describe("true si el caso no tiene una única cartera común y debe usar el cajón de relaciones de cada ficha"),
  }),
  ring: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(["protagonista", "secundaria"]),
    subtitle: z.string().describe("Una línea humana; qué es y por qué está aquí"),
    tag: z.string().describe("Papel corto y visual de la entidad en este caso, p. ej. PROMOTOR o REGULADOR"),
    tagTone: z.enum(["red", "blue", "green", "yellow"]).describe("Color que agrupa papeles equivalentes dentro del caso"),
  })).describe("Entre 3 y 9 fichas protagonistas"),
  headline: z.object({
    bridge: z.string().describe("Nombre del cruce que hay que ensayar: el más legible y más al foco de la pregunta"),
    why: z.string().describe("Por qué ese y no otro"),
  }).optional().describe("Campo legado: el relato nuevo vive en story"),
  bridges: z.array(z.object({
    name: z.string(),
    id: z.string().nullable().describe("UUID canónico si lo conocés, null si no"),
    holders: z.array(z.string()).describe("Nombres de las fichas del anillo que lo sostienen"),
    verified: z.boolean().describe("true solo si comprobaste que sale al tirar de TODAS ellas"),
  })),
  cover: z.array(z.object({
    label: z.string().describe("Etiqueta corta del dato, en español"),
    fields: z.array(z.string()).describe(
      "Claves de campo por orden de preferencia. Priorizá las que viste en los `results` de " +
      "knowledge_query (city, location, funding, focus, description, notable_details, founded_year…), " +
      "que son las que llegan a la ficha; las de la API de entidades sirven de respaldo.",
    ),
    fallback: z.string().describe("Qué poner cuando ninguna de esas claves existe, p. ej. 'sin sede conocida'"),
  })).describe(
    "Los tres datos de la portada de una ficha, decididos POR ESTE CASO. No asumas dinero y " +
    "ubicación: para fundadores lo pertinente es rol y empresa, para leyes sería jurisdicción y " +
    "fecha. Elegí lo que de verdad distingue una ficha de otra en este tablón.",
  ),
  back: z.object({
    fields: z.array(z.string()).describe("Claves que se muestran al voltear la ficha"),
    hint: z.string().describe("Qué se espera leer en el dorso, en una línea"),
  }).describe("El dorso de la ficha: lo que se ve al pasar de página"),
  nouns: z.array(z.object({
    type: z.string().describe("Tipo de relación tal cual lo devuelve Cala"),
    noun: z.string().describe("Sustantivo simétrico en español"),
  })).describe(
    "UNA ENTRADA POR CADA TIPO DE RELACIÓN QUE HAYAS VISTO en la introspección de cualquier ficha, " +
    "no solo el de abrir. Si viste ocho tipos, devolvé ocho. Se usan para rotular los hilos y los " +
    "cabos de cada ficha, y un tipo sin traducir sale en crudo en pantalla.",
  ),
  finding: z.object({
    template: z.string().describe("Con {holders} y {target}"),
    toast: z.string().describe("Con {holders} y {target}"),
  }),
  story: z.object({
    restartOnLoad: z.boolean().default(true).describe("true para que la demo siempre empiece solo con la pregunta"),
    label: z.string().describe("Nombre corto de este recorrido"),
    questionLabel: z.string().describe("Rótulo de la pregunta; depende del caso"),
    scope: z.string().describe("Geografía, mercado, periodo y denominador que realmente cubre la evidencia"),
    answer: z.object({
      label: z.string().describe("Rótulo de la respuesta inicial"),
      headline: z.string().describe("Respuesta directa y honesta, aunque sea 'aún no lo sabemos'"),
      body: z.string().describe("Qué permite afirmar la evidencia y qué no"),
    }),
    facts: z.array(z.object({
      value: z.string().optional().describe("Cifra o valor destacado solo si existe"),
      label: z.string(),
      detail: z.string().optional(),
      sourceLabel: z.string(),
      sourceUrl: z.string().optional(),
      asOf: z.string().optional(),
    })).max(3).default([]),
    actors: z.object({
      label: z.string().describe("Rótulo del reparto; no tiene por qué decir actores"),
      title: z.string(),
      body: z.string().describe("Distingue los papeles; no presenta entidades heterogéneas como equivalentes"),
    }).optional(),
    limitationLabel: z.string(),
    limitation: z.string().describe("La respuesta que los datos NO sostienen"),
    action: z.object({
      label: z.string().describe("Una única acción recomendada, escrita para una persona"),
      body: z.string().describe("Instrucción concreta usando los rótulos elegidos para este caso"),
      entityId: z.string().describe("UUID de la ficha que debe recibir la señal visual"),
      relationType: z.string().describe("Relación concreta que produce la revelación"),
      pendingLabel: z.string(),
      revealedLabel: z.string(),
    }),
    reveal: z.object({
      headline: z.string().describe("El hallazgo en una frase completa"),
      body: z.string().describe("Por qué responde o cambia la pregunta"),
      sourceLabel: z.string(),
      sourceUrl: z.string().optional(),
      asOf: z.string().optional(),
    }).optional(),
    nextLabel: z.string().optional(),
    nextQuestion: z.string().optional(),
  }),
  ui: z.object({
    caseOpen: z.string(),
    caseFinding: z.string(),
    cards: z.string(),
    leads: z.string(),
    connections: z.string(),
    connection: z.string(),
    noConnections: z.string(),
    showConnections: z.string(),
    hideConnections: z.string(),
    foundConnection: z.string(),
    openLead: z.string(),
    lead: z.string(),
    details: z.string(),
    front: z.string(),
    moreConnections: z.string(),
    collectConnections: z.string(),
    archiveQuestion: z.string(),
    externalQuestion: z.string(),
    askArchive: z.string(),
    askExternal: z.string(),
    archivePanel: z.string(),
  }).describe("Toda la gramática visible; debe ser neutral para el dominio de la consulta"),
  questions: z.array(z.object({
    id: z.string(),
    prompt: z.string(),
    lane: z.enum(["archive", "web"]),
    target: z.object({
      id: z.string(),
      name: z.string(),
      entityType: z.string(),
      relation: z.string(),
      preferred: z.array(z.string()).max(5),
    }).optional(),
    answer: z.object({
      title: z.string(),
      body: z.string(),
      sourceLabel: z.string(),
      sourceUrl: z.string().optional(),
      asOf: z.string().optional(),
    }),
  })).max(2).optional().default([]),
  notes: z.string().describe("Falsos positivos descartados, dudas, por qué quedó algo fuera"),
});

function resolveModel() {
  const id = process.env.CASE_MODEL ?? "gpt-5.6-sol";
  if (process.env.AI_GATEWAY_API_KEY) return { model: `openai/${id}`, via: "gateway" };
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY (o AI_GATEWAY_API_KEY) en .env");
  return { model: null, id, via: "openai" };
}

const query = process.argv.slice(2).filter((a) => !a.startsWith("--")).join(" ");
if (!query) {
  console.error('Uso: node --env-file=.env scripts/build-case.mjs "<consulta>"');
  process.exit(1);
}

const brief = await readFile("scripts/case-agent.md", "utf8");
const picked = resolveModel();
let model = picked.model;
if (picked.via === "openai") {
  const { openai } = await import("@ai-sdk/openai");
  model = openai(picked.id);
}

console.log(`caso: ${query}\nmodelo: ${picked.model ?? picked.id} (${picked.via})\npresupuesto: ${BUDGET} llamadas\n`);

const agent = new ToolLoopAgent({
  model,
  tools,
  system: brief,
  stopWhen: isStepCount(Number(process.env.CASE_STEPS ?? 40)),
  output: Output.object({ schema: manifest }),
  providerOptions: { openai: { reasoningEffort: process.env.CASE_EFFORT ?? "high" } },
  onStepFinish: ({ toolCalls }) => {
    for (const call of toolCalls ?? []) console.log(`  · ${call.toolName}`);
  },
});

const { output } = await agent.generate({
  prompt: `Construí el manifiesto para esta consulta al archivo de Cala:\n\n${query}\n\n` +
    `Investigá antes de decidir: mirá qué sale, elegí de quién tirar y comprobá los cruces. ` +
    `Tenés ${BUDGET} llamadas en total.`,
});

const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const file = path.join(OUT, `${slug}.json`);
await mkdir(OUT, { recursive: true });
await writeFile(file, JSON.stringify({
  version: 2,
  query,
  slug,
  generatedAt: new Date().toISOString(),
  model: picked.model ?? picked.id,
  calls: spent,
  ...output,
}, null, 2));

console.log(`\n✓ ${file}`);
console.log(`  ${output.ring.length} fichas · ${output.bridges.length} cruces · ${spent} llamadas`);
for (const b of output.bridges) console.log(`  ${b.verified ? "✓" : "?"} ${b.name} ← ${b.holders.join(" + ")}`);
