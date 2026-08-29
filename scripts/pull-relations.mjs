#!/usr/bin/env node
/**
 * Trae las relaciones reales de las entidades semilla y las cachea en disco.
 * Throttled a 3s por llamada: el rate limit de Cala salta sobre las ~10 seguidas.
 * "El ensayo paga, la demo cobra" — esto se ejecuta una vez, la app lee el JSON.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const KEY = process.env.CALA_API_KEY;
const OUT = 'data/relations';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = [
  ['dc60f800-f723-41b8-9482-810db28c9d70', 'DN Capital'],
  ['eb86df55-d9fb-41bc-8104-ad6a892dc7ec', 'Bnext'],
  ['4712a5e8-fa2e-4f27-9375-73b8fdbd3faf', 'K-Fund'],
  ['e1bedcfd-ee74-4cb3-8059-d30de61462af', 'Seaya Ventures'],
  ['d13f79c8-6698-4f4f-b98c-1a28d60d80b8', 'Kibo Ventures'],
  ['e3a596f9-cb53-454e-ac29-8bf2c69f1d67', 'BBVA Spark Fund'],
  ['f214cceb-1823-442b-b891-4f5e4047cab5', 'Fintonic'],
];

async function api(path, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await wait(5000 * attempt);
    const res = await fetch(`https://api.cala.ai/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-API-KEY': KEY, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(45000),
    });
    if (res.status === 429) { console.log(`   429, esperando…`); continue; }
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
    return res.json();
  }
  throw new Error('rate limited tras 4 intentos');
}

await mkdir(OUT, { recursive: true });
const graph = {};

for (const [id, name] of SEED) {
  const file = `${OUT}/${id}.json`;
  if (existsSync(file)) {
    graph[id] = JSON.parse(await readFile(file, 'utf8'));
    console.log(`skip  ${name}`);
    continue;
  }
  console.log(`pull  ${name}`);
  const intro = await api(`/entities/${id}/introspection`);
  await wait(3000);
  const out = intro.relationships?.outgoing ?? [];
  const inc = intro.relationships?.incoming ?? [];
  let projection = { relationships: {} };
  if (out.length || inc.length) {
    projection = await api(`/entities/${id}`, {
      properties: ['name', 'description'],
      relationships: {
        outgoing: Object.fromEntries(out.map((t) => [t, { limit: 20 }])),
        incoming: Object.fromEntries(inc.map((t) => [t, { limit: 20 }])),
      },
    });
    await wait(3000);
  }
  const record = { id, name, introspection: intro, projection };
  // el id se reusa abajo al indexar el grafo
  await writeFile(file, JSON.stringify(record, null, 2));
  graph[id] = record;
  console.log(`   out=[${out}] in=[${inc}]`);
}

// ¿quién comparte vecinos con quién? Eso son los hilos cruzados del tablón.
const neighbors = {};
for (const rec of Object.values(graph)) {
  const set = new Map();
  for (const [dir, types] of Object.entries(rec.projection.relationships ?? {}))
    for (const [type, items] of Object.entries(types))
      for (const it of items) set.set(it.id, { name: it.name, type, dir });
  neighbors[rec.name] = set;
}

console.log('\n── vecinos por ficha ──');
for (const [name, set] of Object.entries(neighbors)) console.log(`  ${name.padEnd(18)} ${set.size}`);

const shared = new Map();
for (const [name, set] of Object.entries(neighbors))
  for (const [nid, meta] of set) {
    if (!shared.has(nid)) shared.set(nid, { name: meta.name, holders: [] });
    shared.get(nid).holders.push(name);
  }

console.log('\n── vecinos COMPARTIDOS (los hilos cruzados) ──');
const cross = [...shared.values()].filter((s) => s.holders.length > 1);
for (const s of cross) console.log(`  ${s.name.padEnd(34)} ← ${s.holders.join(' + ')}`);
console.log(`\n${cross.length} nodos puente de ${shared.size} vecinos totales`);
await writeFile(`${OUT}/_analysis.json`, JSON.stringify({ neighbors: Object.fromEntries(Object.entries(neighbors).map(([k,v])=>[k,[...v].map(([id,m])=>({id,...m}))])), cross }, null, 2));
