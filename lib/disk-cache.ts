import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const inFlight = new Map<string, Promise<unknown>>();

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function cacheKey(operation: string, input: unknown) {
  return createHash("sha256").update(`${operation}:${stable(input)}`).digest("hex");
}

function cachePath(operation: string, key: string) {
  const safeOperation = operation.replace(/[^a-z0-9_-]/gi, "-");
  return path.join(CACHE_DIR, `${safeOperation}-${key}.json`);
}

export async function readCache<T>(operation: string, input: unknown): Promise<T | undefined> {
  const key = cacheKey(operation, input);
  try {
    return JSON.parse(await readFile(cachePath(operation, key), "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeCache<T>(operation: string, input: unknown, value: T) {
  await mkdir(CACHE_DIR, { recursive: true });
  const key = cacheKey(operation, input);
  const target = cachePath(operation, key);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  try {
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
  return value;
}

export async function cacheFirst<T>(operation: string, input: unknown, loader: () => Promise<T>) {
  const cached = await readCache<T>(operation, input);
  if (cached !== undefined) return { value: cached, hit: true };
  const key = `${operation}:${cacheKey(operation, input)}`;
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return { value: await existing, hit: true };
  const pending = loader().then((value) => writeCache(operation, input, value));
  inFlight.set(key, pending);
  try {
    return { value: await pending, hit: false };
  } finally {
    inFlight.delete(key);
  }
}
