#!/usr/bin/env node
/**
 * Batch runner for the Cala AI knowledge API.
 *
 * Usage:
 *   node --env-file=.env scripts/cala-query.mjs "startups.location=Spain.funding>10M"
 *   node --env-file=.env scripts/cala-query.mjs --file queries.txt --concurrency 3
 *
 * Notes from probing the API:
 *   - A single query can take ~60s, so the default timeout is deliberately high.
 *   - The shape of `results[]` changes per query (one asks for startups and gets
 *     `startup/location/funding/sector`, another gets `name/focus/founded/...`),
 *     so nothing here assumes a fixed record schema.
 */

import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const API_URL = process.env.CALA_API_URL ?? 'https://api.cala.ai/v1/knowledge/query';
const API_KEY = process.env.CALA_API_KEY;

function parseArgs(argv) {
  const opts = {
    queries: [],
    file: null,
    out: 'data/cala',
    concurrency: 2,
    timeout: 180_000,
    retries: 2,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--file': opts.file = argv[++i]; break;
      case '--out': opts.out = argv[++i]; break;
      case '--concurrency': opts.concurrency = Number(argv[++i]); break;
      case '--timeout': opts.timeout = Number(argv[++i]); break;
      case '--retries': opts.retries = Number(argv[++i]); break;
      case '--force': opts.force = true; break;
      case '-h':
      case '--help': opts.help = true; break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
        opts.queries.push(arg);
    }
  }
  return opts;
}

const slug = (q) =>
  q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'query';

async function query(input, { timeout, retries }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    const startedAt = Date.now();
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(timeout),
      });
      const text = await res.text();
      const ms = Date.now() - startedAt;
      if (!res.ok) {
        // 4xx other than 429 will not get better by retrying.
        if (res.status < 500 && res.status !== 429) {
          return { ok: false, status: res.status, ms, attempt, error: text.slice(0, 500) };
        }
        lastError = { ok: false, status: res.status, ms, attempt, error: text.slice(0, 500) };
        continue;
      }
      return { ok: true, status: res.status, ms, attempt, data: JSON.parse(text) };
    } catch (err) {
      lastError = { ok: false, status: 0, ms: Date.now() - startedAt, attempt, error: String(err) };
    }
  }
  return lastError;
}

async function runPool(items, concurrency, worker) {
  const queue = [...items.entries()];
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      await worker(next[1], next[0]);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`cala-query — batch runner for the Cala knowledge API

  node --env-file=.env scripts/cala-query.mjs "<query>" ["<query>" ...]
  node --env-file=.env scripts/cala-query.mjs --file queries.txt

  --file <path>         newline-separated queries (# comments and blanks ignored)
  --out <dir>           output directory (default: data/cala)
  --concurrency <n>     parallel requests (default: 2)
  --timeout <ms>        per-request timeout (default: 180000)
  --retries <n>         retries on 5xx/429/network errors (default: 2)
  --force               re-run queries that already have a result file
`);
    return;
  }

  if (!API_KEY) {
    console.error('Missing CALA_API_KEY. Run with: node --env-file=.env scripts/cala-query.mjs ...');
    process.exit(1);
  }

  let queries = opts.queries;
  if (opts.file) {
    const raw = await readFile(opts.file, 'utf8');
    queries = queries.concat(
      raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    );
  }
  queries = [...new Set(queries)];

  if (queries.length === 0) {
    console.error('No queries given. Pass them as arguments or via --file. See --help.');
    process.exit(1);
  }

  await mkdir(opts.out, { recursive: true });
  const recordsPath = path.join(opts.out, 'records.ndjson');
  const runAt = new Date().toISOString();
  const summary = [];

  await runPool(queries, opts.concurrency, async (input) => {
    const file = path.join(opts.out, `${slug(input)}.json`);
    if (!opts.force && existsSync(file)) {
      console.log(`skip   ${input}  (exists: ${file})`);
      summary.push({ input, status: 'skipped' });
      return;
    }

    console.log(`start  ${input}`);
    const res = await query(input, opts);

    if (!res.ok) {
      console.error(`FAIL   ${input}  [${res.status}] ${res.error}`);
      summary.push({ input, status: `failed ${res.status}` });
      await writeFile(file, JSON.stringify({ input, runAt, ok: false, ...res }, null, 2));
      return;
    }

    await writeFile(file, JSON.stringify({ input, runAt, ...res }, null, 2));

    // Flatten every record with its originating query so results across
    // differently-shaped queries stay joinable downstream.
    const results = Array.isArray(res.data?.results) ? res.data.results : [];
    const entities = Array.isArray(res.data?.entities) ? res.data.entities : [];
    const lines = [
      ...results.map((r) => JSON.stringify({ _query: input, _runAt: runAt, _kind: 'result', ...r })),
      ...entities.map((e) => JSON.stringify({ _query: input, _runAt: runAt, _kind: 'entity', ...e })),
    ];
    if (lines.length) await appendFile(recordsPath, lines.join('\n') + '\n');

    console.log(
      `ok     ${input}  ${results.length} results, ${entities.length} entities, ${(res.ms / 1000).toFixed(1)}s → ${file}`
    );
    summary.push({ input, status: 'ok', results: results.length, entities: entities.length, seconds: +(res.ms / 1000).toFixed(1) });
  });

  console.log('\n— summary —');
  console.table(summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
