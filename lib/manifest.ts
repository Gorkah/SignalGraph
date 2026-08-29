import "server-only";

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { CaseManifest } from "@/lib/types";

const CASES_DIR = path.join(process.cwd(), "data", "cases");

/**
 * El manifiesto es lo que un agente decidió sobre este caso: la pregunta, qué
 * relación significa "abrir" una ficha, quién sale en el anillo, qué lleva
 * cada ficha en portada y cómo se redacta el hallazgo. El código no sabe nada
 * de fondos ni de fundadores; solo dibuja lo que aquí se diga.
 *
 * Se elige con CASE_SLUG, o el más reciente si no se dice nada.
 */
export function loadManifest(): CaseManifest | undefined {
  let files: string[];
  try {
    files = readdirSync(CASES_DIR).filter((file) => file.endsWith(".json"));
  } catch {
    return undefined;
  }
  if (!files.length) return undefined;

  const wanted = process.env.CASE_SLUG ? `${process.env.CASE_SLUG}.json` : undefined;
  const chosen = (wanted && files.includes(wanted) ? wanted : undefined)
    ?? files.map((file) => ({ file, at: readCaseDate(file) }))
      .sort((a, b) => b.at.localeCompare(a.at))[0].file;

  try {
    return JSON.parse(readFileSync(path.join(CASES_DIR, chosen), "utf8")) as CaseManifest;
  } catch {
    return undefined;
  }
}

function readCaseDate(file: string) {
  try {
    const raw = JSON.parse(readFileSync(path.join(CASES_DIR, file), "utf8")) as { generatedAt?: string };
    return raw.generatedAt ?? "";
  } catch {
    return "";
  }
}

/** Lo que necesita el cliente para pintar: sin notas ni material de trabajo. */
export function clientView(manifest: CaseManifest | undefined) {
  if (!manifest) return undefined;
  return {
    query: manifest.query,
    openVerb: manifest.openVerb,
    cover: manifest.cover,
    back: manifest.back,
    nouns: manifest.nouns,
    finding: manifest.finding,
  };
}
