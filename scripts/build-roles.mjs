#!/usr/bin/env node
/**
 * build-roles — borrador de `data/seed-roles.json`.
 *
 * QUÉ HACE ESTE SCRIPT (la parte mecánica y reproducible)
 * ------------------------------------------------------
 * Recorre `data/cala/*.json` (dossieres de query) y `data/relations/*.json`
 * (relaciones reales por entidad), deduplica por nombre normalizado —Cala
 * fragmenta una misma empresa en varios UUID: hay cinco "Sesame" y seis
 * "Tucuvi"— elige un id canónico, lista el resto como alias, y calcula los
 * candidatos a `puente` desde los vecinos compartidos del grafo INVESTED_IN.
 * Emite el borrador por stdout.
 *
 * QUÉ NO HACE (el juicio final lo pone una pasada de LLM)
 * ------------------------------------------------------
 * No decide el caso. Los `entity_type` que devuelve Cala son ruido —la misma
 * clase de entidad llega unas veces como `Organization` y otras como
 * `Company`— así que aquí solo hay léxico y grafo: un fondo se detecta porque
 * se llama "Ventures", no porque el grafo lo sepa. Todo lo que no se deduce
 * con seguridad sale marcado `"review": true`.
 *
 * El fichero que lee la demo, `data/seed-roles.json`, es el resultado de pasar
 * este borrador por un LLM que asigna el rol definitivo y escribe el subtítulo
 * de cada ficha. A partir de ahí SE EDITA A MANO: está versionado justamente
 * para eso, y la demo nunca ejecuta nada en vivo. Este script existe para
 * poder rehacer el borrador cuando entren dossieres o relaciones nuevas, no
 * para regenerar el fichero bueno encima.
 *
 * USO
 *   node scripts/build-roles.mjs                 # borrador completo por stdout
 *   node scripts/build-roles.mjs --merge         # conserva rol y subtítulo ya
 *                                                # escritos a mano y marca
 *                                                # `review` solo lo nuevo
 *   node scripts/build-roles.mjs --merge --diff  # solo el resumen de cambios
 *
 * Nunca escribe sobre `data/seed-roles.json`; redirigí a donde quieras y
 * mergeá a mano lo que valga la pena.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CALA_DIR = path.join(ROOT, "data", "cala");
const RELATIONS_DIR = path.join(ROOT, "data", "relations");
const CURRENT = path.join(ROOT, "data", "seed-roles.json");

const args = new Set(process.argv.slice(2));
const MERGE = args.has("--merge");
const DIFF_ONLY = args.has("--diff");

const VERSION = 1;
const CASE = "¿Quién financia el fintech español?";

/** El rol es de la entidad, no del `entity_type`: Cala no distingue. */
const ROLE_GLOSSARY = {
  financia: "Pone dinero: fondos, family offices, bancos, corporate venture, programas públicos, business angels.",
  financiada: "Empresa que recibe inversión.",
  puente:
    "Aparece en la cartera de dos o más financiadores que tienen hilo propio en data/relations. Es el reencuentro que busca la demo: la misma ficha alcanzable desde dos sitios del anillo.",
  ruido:
    "Sectores, países, eventos de financiación sin nombre, personas, categorías abstractas y duplicados. No ocupan sitio en el corcho.",
};

// ── normalización ────────────────────────────────────────────────────────────

/** Formas societarias: "EMBAT TECHNOLOGIES SL" y "Embat" no se fusionan solas,
 *  pero sí "Wallbox N.V." con "Wallbox". Lo que quede suelto lo une el LLM. */
const LEGAL = [
  "sociedad anonima", "sociedad unipersonal", "s a r l", "sgeic", "sgiic", "sicc",
  "s l u", "s l", "s a", "sau", "slu", "sl", "sa", "inc", "llc", "llp", "ltd",
  "limited", "gmbh", "ag", "nv", "bv", "se", "spa", "plc", "oy", "ou", "as",
  "aps", "ab", "kft", "zrt", "srl", "sas", "sarl", "corp", "co",
];

function strip(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Clave de deduplicación: sin acentos, sin puntuación, sin forma societaria. */
function nameKey(value) {
  let key = strip(value);
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL) {
      if (key.endsWith(` ${suffix}`)) {
        key = key.slice(0, -suffix.length - 1).trim();
        changed = true;
      }
    }
  }
  return key.replace(/ /g, "");
}

/** Familia: "BBVA Spark Fund", "BBVA Spark Growth Instrument" y "BBVA SA" son
 *  el mismo bolsillo, y "KIBO VENTURES PARTNERS SGEIC" es Kibo. Sin colapsar
 *  por la primera palabra, Sesame parecería un puente con tres inversores
 *  cuando todo su dinero es de BBVA. Choca de vez en cuando ("Fondo Bolsa
 *  Social" con "Fondo OÜ"); son financiadores ambos, así que no rompe nada. */
function familyKey(value) {
  return strip(value).split(" ").filter(Boolean)[0] ?? strip(value);
}

// ── carga ────────────────────────────────────────────────────────────────────

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function loadCala() {
  if (!existsSync(CALA_DIR)) return [];
  return readdirSync(CALA_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({ file, dump: readJson(path.join(CALA_DIR, file)) }))
    .filter(({ dump }) => dump.ok && dump.data);
}

function loadRelations() {
  if (!existsSync(RELATIONS_DIR)) return [];
  return readdirSync(RELATIONS_DIR)
    .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
    .sort()
    .map((file) => readJson(path.join(RELATIONS_DIR, file)));
}

const calaDumps = loadCala();
const relationDumps = loadRelations();

// ── universo de entidades ────────────────────────────────────────────────────

/** @type {Map<string, {key:string,name:string,ids:Map<string,string>,types:Set<string>,sources:Set<string>,queries:Set<string>,invested:Set<string>,hasDump:boolean,dumpId?:string,calaId?:string}>} */
const universe = new Map();

function observe(id, name, { entityType, source, query, dumpId } = {}) {
  const key = nameKey(name);
  if (!key || !id) return undefined;
  let entry = universe.get(key);
  if (!entry) {
    entry = {
      key,
      name,
      ids: new Map(),
      types: new Set(),
      sources: new Set(),
      queries: new Set(),
      invested: new Set(),
      hasDump: false,
    };
    universe.set(key, entry);
  }
  entry.ids.set(id, name);
  if (entityType) entry.types.add(entityType);
  if (source) entry.sources.add(source);
  if (query) entry.queries.add(query);
  if (dumpId) {
    entry.hasDump = true;
    entry.dumpId = id;
  }
  if (source === "cala" && !entry.calaId) entry.calaId = id;
  return entry;
}

for (const { dump } of calaDumps) {
  for (const entity of dump.data?.entities ?? []) {
    observe(entity.id, entity.name, {
      entityType: entity.entity_type,
      source: "cala",
      query: dump.input,
    });
  }
}

for (const dump of relationDumps) {
  const subject = observe(dump.id, dump.name, { source: "relations", dumpId: dump.id });
  for (const types of Object.values(dump.projection?.relationships ?? {})) {
    for (const [type, items] of Object.entries(types)) {
      for (const item of items) {
        const neighbour = observe(item.id, item.name, {
          entityType: item.entity_type,
          source: "vecino",
        });
        // La dirección de Cala no es fiable (el INVESTED_IN saliente de Bnext
        // apunta a sus inversores), así que el grafo de dinero se lee sin flecha.
        if (type === "INVESTED_IN" && subject && neighbour) {
          subject.invested.add(neighbour.key);
          neighbour.invested.add(subject.key);
        }
      }
    }
  }
}

// ── clasificación mecánica ───────────────────────────────────────────────────

const SNAKE = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/;
const GEO_TYPES = new Set(["Country", "Municipality", "Region", "City", "State", "GPE", "Location"]);
const ABSTRACT_TYPES = new Set(["Industry", "Product", "WorkOfArt", "Group", "Event"]);

/** Un fondo se reconoce por cómo se llama. Es léxico, no ontología: por eso
 *  todo lo que entra por aquí y no está confirmado sale con `review`. */
const INVESTOR_WORDS = [
  "ventures", "venture", "capital", "partners", "fund", "fondo", "invest",
  "investment", "investments", "equity", "sgeic", "sgiic", "vc", "seed",
  "accelerator", "aceleradora", "combinator", "family office", "spark",
  "bank", "banco", "banca", "labs", "gr[uü]nderfonds", "startups group",
];
const INVESTOR_RE = new RegExp(`\\b(${INVESTOR_WORDS.join("|")})\\b`, "i");

/** Nombres que Cala devuelve como entidad y no lo son: cubos, placeholders.
 *  Anclado al final a propósito: "Europe" es ruido, "European Investment Bank"
 *  es un financiador público y con `^europe` a secas caía del mismo lado. */
const PLACEHOLDER_RE = /^(unknown investor|unnamed .*|senior-care startup|artificial intelligence companies in .*|vcbacked|europe|asia)$/i;

function noiseReason(entry) {
  if (SNAKE.test(entry.name)) return "token de relación o sector, no un actor";
  if (PLACEHOLDER_RE.test(entry.name)) return "marcador de posición del grafo, no una entidad";
  const types = [...entry.types];
  if (types.some((type) => GEO_TYPES.has(type))) return "geografía, no un actor";
  if (types.some((type) => ABSTRACT_TYPES.has(type))) return "categoría abstracta, no un actor";
  if (types.includes("Person")) return "persona, y el caso pregunta por quién pone el dinero";
  return undefined;
}

function looksLikeInvestor(entry) {
  if (INVESTOR_RE.test(entry.name)) return true;
  return [...entry.queries].some((query) => query.startsWith("investors."));
}

// Primera pasada: quién financia (para poder contar puentes después).
const draft = new Map();
for (const entry of universe.values()) {
  const noise = noiseReason(entry);
  if (noise) {
    draft.set(entry.key, { role: "ruido", why: noise, review: false });
  } else if (looksLikeInvestor(entry)) {
    draft.set(entry.key, { role: "financia", why: "el nombre o el dossier lo sitúan del lado del dinero", review: true });
  } else {
    draft.set(entry.key, { role: undefined, why: undefined, review: true });
  }
}

const isFinancier = (key) => draft.get(key)?.role === "financia";

/**
 * Financiadores distintos de una entidad, colapsados por familia.
 * `board` restringe a los que tienen volcado de relaciones propio: son los
 * únicos de los que la demo puede tirar un hilo, así que un puente entre dos
 * de ellos es un reencuentro que se ve en el corcho. Con dos inversores
 * cualesquiera —dos nombres sueltos dentro de la misma ficha— no se ve nada.
 */
function backersOf(entry, { board = false } = {}) {
  const families = new Map();
  for (const key of entry.invested) {
    if (!isFinancier(key)) continue;
    const other = universe.get(key);
    if (!other || (board && !other.hasDump)) continue;
    const family = familyKey(other.name);
    if (!families.has(family)) families.set(family, other.name);
  }
  return [...families.values()].sort();
}

// Segunda pasada: financiadas y puentes.
for (const entry of universe.values()) {
  const row = draft.get(entry.key);
  if (row.role === "ruido" || row.role === "financia") continue;
  const onBoard = backersOf(entry, { board: true });
  const backers = backersOf(entry);
  if (onBoard.length >= 2) {
    Object.assign(row, {
      role: "puente",
      why: `en la cartera de ${onBoard.length} financiadores con hilo propio`,
      backers: onBoard,
      review: false,
    });
  } else if (backers.length) {
    Object.assign(row, {
      role: "financiada",
      why: `en la cartera de ${backers[0]}`,
      backers: onBoard.length ? onBoard : backers.slice(0, 1),
      review: false,
    });
  } else if (entry.invested.size > 0) {
    Object.assign(row, { role: "financiada", why: "cuelga del grafo de inversión", review: true });
  } else {
    Object.assign(row, { role: "ruido", why: "sin cabo de inversión en el volcado", review: true });
  }
}

// Los financiadores también quieren saber a cuántos llegan.
for (const entry of universe.values()) {
  const row = draft.get(entry.key);
  if (row.role !== "financia") continue;
  row.portfolio = [...entry.invested].filter((key) => !isFinancier(key)).length;
}

// ── subtítulos por defecto ───────────────────────────────────────────────────

/** Plantillas honestas: dicen lo que el grafo sabe y nada más. El registro
 *  humano ("El fondo generalista de Madrid") lo escribe el LLM encima. */
function draftSubtitle(entry, row) {
  switch (row.role) {
    case "financia":
      return row.portfolio
        ? `Financiador; ${row.portfolio} participadas en el volcado.`
        : "Financiador; sin cartera en el volcado.";
    case "puente":
      return `Comparten cartera ${row.backers.join(" y ")}.`;
    case "financiada":
      return row.backers?.length ? `En la cartera de ${row.backers[0]}.` : "Cuelga del grafo de inversión.";
    default:
      return `${row.why.charAt(0).toUpperCase()}${row.why.slice(1)}.`;
  }
}

// ── id canónico y alias ──────────────────────────────────────────────────────

/** Manda el id que tiene volcado de relaciones; si no, el que sale en un
 *  dossier de query; si no, el primero que se vio. Los demás son alias. */
function canonicalId(entry) {
  return entry.dumpId ?? entry.calaId ?? [...entry.ids.keys()][0];
}

const ORDER = { financia: 0, puente: 1, financiada: 2, ruido: 3 };

const entities = [...universe.values()]
  .map((entry) => {
    const row = draft.get(entry.key);
    const id = canonicalId(entry);
    const aliases = [...entry.ids]
      .filter(([aliasId]) => aliasId !== id)
      .map(([aliasId, aliasName]) => ({ id: aliasId, name: aliasName }));
    const record = {
      id,
      name: entry.ids.get(id) ?? entry.name,
      role: row.role,
      subtitle: draftSubtitle(entry, row),
    };
    if (aliases.length) record.aliases = aliases;
    if (row.backers?.length) record.backers = row.backers;
    if (row.review) record.review = row.why ?? "sin señal suficiente; decidilo a mano";
    return record;
  })
  .sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.name.localeCompare(b.name, "es"));

// El anillo: los `financia` con volcado de relaciones, que son los únicos de
// los que se puede tirar un hilo. Quién entra y en qué orden se reparte por la
// elipse es puesta en escena, no deducción: eso lo decide el LLM y `--merge`
// respeta el anillo que ya esté escrito.
const withDump = new Set(relationDumps.map((dump) => dump.id));
let ring = entities.filter((entity) => entity.role === "financia" && withDump.has(entity.id)).map((entity) => entity.id);

// ── merge con lo ya escrito a mano ───────────────────────────────────────────

const changes = { nuevas: [], desaparecidas: [], rolCambiado: [] };

let merged = entities;

if (MERGE && existsSync(CURRENT)) {
  const current = readJson(CURRENT);
  const byId = new Map();
  for (const entity of current.entities ?? []) {
    byId.set(entity.id, entity);
    for (const alias of entity.aliases ?? []) byId.set(alias.id, entity);
  }
  const idsOf = (entity) => [entity.id, ...(entity.aliases ?? []).map((alias) => alias.id)];
  const seen = new Set();
  const survivors = [];
  for (const entity of entities) {
    const previous = idsOf(entity).map((id) => byId.get(id)).find(Boolean);
    if (!previous) {
      changes.nuevas.push(entity.name);
      survivors.push(entity);
      continue;
    }
    seen.add(previous.id);
    if (previous.role !== entity.role) {
      changes.rolCambiado.push(`${previous.name}: ${previous.role} → ${entity.role} (borrador)`);
    }
    // Gana la mano: el borrador no pisa juicio ya emitido. Rol, subtítulo y
    // nombre de ficha son decisiones, no deducciones.
    if (previous.id !== entity.id && idsOf(previous).includes(entity.id)) {
      // Fusión hecha a mano que este script no sabe deducir: la ficha ya vive
      // dentro de otra entrada, así que aquí desaparece en vez de duplicar id.
      continue;
    }
    Object.assign(entity, {
      role: previous.role,
      name: previous.name,
      subtitle: previous.subtitle,
      ...(previous.backers ? { backers: previous.backers } : {}),
      ...(previous.aliases ? { aliases: previous.aliases } : {}),
    });
    delete entity.review;
    survivors.push(entity);
  }
  for (const entity of current.entities ?? []) {
    if (!seen.has(entity.id)) changes.desaparecidas.push(entity.name);
  }
  merged = survivors.sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.name.localeCompare(b.name, "es"));
  const alive = new Set(merged.map((entity) => entity.id));
  if (current.ring?.length) ring = current.ring.filter((id) => alive.has(id));
}

// ── salida ───────────────────────────────────────────────────────────────────

const counts = merged.reduce((acc, entity) => ({ ...acc, [entity.role]: (acc[entity.role] ?? 0) + 1 }), {});

if (DIFF_ONLY) {
  console.error(`reparto: ${JSON.stringify(counts)}`);
  console.error(`nuevas (${changes.nuevas.length}): ${changes.nuevas.join(", ") || "—"}`);
  console.error(`ya no aparecen (${changes.desaparecidas.length}): ${changes.desaparecidas.join(", ") || "—"}`);
  console.error(`rol distinto al borrador (${changes.rolCambiado.length}):\n  ${changes.rolCambiado.join("\n  ") || "—"}`);
  process.exit(0);
}

const payload = {
  version: VERSION,
  case: CASE,
  roles: ROLE_GLOSSARY,
  sources: ["data/cala/*.json", "data/relations/*.json"],
  regenerate: "node scripts/build-roles.mjs  ·  emite el BORRADOR por stdout. El rol definitivo y el subtítulo los pone una pasada de LLM y este fichero se edita a mano.",
  draft: !MERGE,
  ring,
  entities: merged,
};

console.log(JSON.stringify(payload, null, 2));
console.error(`${merged.length} entidades · ${JSON.stringify(counts)} · anillo de ${ring.length}`);
if (MERGE) console.error(`nuevas: ${changes.nuevas.length} · desaparecidas: ${changes.desaparecidas.length} · rol distinto: ${changes.rolCambiado.length}`);
