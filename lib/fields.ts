import type { Claim } from "@/lib/types";

// Las unidades van de más larga a más corta: si `m` va primero se come la
// "m" de "million" y deja "€83 m". El importe se muestra como cita textual
// —incluido el "over" o el "up to"—, nunca como número parseado.
const AMOUNT = String.raw`(?:€|\$|£|US\$)\s?\d+(?:[.,]\d+)?\s?(?:billion|million|bn|k|m)?\b`;
const MONEY_PATTERN = new RegExp(
  String.raw`(?:over|up to|about|around|approx\.?|~)?\s*${AMOUNT}(?:\s?[–-]\s?${AMOUNT})?`,
  "i",
);

const MONEY_KEYS = ["funding", "notable_funding", "total_key_round"];
const PLACE_KEYS = ["city", "location"];
const DESCRIPTION_KEYS = ["description", "focus", "details", "notable_details", "sector", "type"];

/**
 * Solo lo que el archivo dice DE la entidad.
 *
 * Un claim de mención sale de un resultado que la nombra de pasada —la
 * descripción de otra empresa que la cita como inversora—, y ponerlo en su
 * ficha es atribuirle palabras ajenas. Preferimos un hueco honesto: por eso
 * BBVA Spark deja de contar la vida de otra compañía.
 */
function own(claims: Claim[], used?: Set<Claim>) {
  return claims.filter((claim) => !claim.mention && !used?.has(claim));
}

function firstByKeys(claims: Claim[], keys: string[]) {
  for (const key of keys) {
    const claim = claims.find((item) => item.key === key && item.value.trim());
    if (claim) return claim;
  }
  return undefined;
}

export function moneyFromClaims(claims: Claim[]) {
  // Primero los campos que hablan de dinero; si no, cualquier texto que lo lleve.
  const ordered = [
    ...claims.filter((claim) => MONEY_KEYS.includes(claim.key)),
    ...claims.filter((claim) => !MONEY_KEYS.includes(claim.key)),
  ];
  for (const claim of ordered) {
    const match = claim.value.match(MONEY_PATTERN);
    if (match?.[0]?.trim()) return { ...claim, value: match[0].trim() };
  }
  return undefined;
}

/** Dónde está: la ciudad manda sobre la ubicación amplia. */
export function placeFromClaims(claims: Claim[]) {
  return firstByKeys(claims, PLACE_KEYS);
}

/**
 * Un renglón de portada es un dato, no un párrafo. Cuando el archivo solo
 * tiene prosa, la portada enseña el arranque —cortado por la primera frase o
 * por la última palabra que cabe— y el resto se lee al dorso.
 */
const TEASER_MAX = 54;

export function isProse(claim: Claim) {
  return claim.value.trim().length > TEASER_MAX;
}

export function teaser(value: string) {
  const text = value.trim();
  if (text.length <= TEASER_MAX) return text;
  const stop = text.slice(0, TEASER_MAX + 1).lastIndexOf(". ");
  if (stop > 24) return text.slice(0, stop + 1);
  const cut = text.lastIndexOf(" ", TEASER_MAX);
  return `${text.slice(0, cut > 24 ? cut : TEASER_MAX).trimEnd()}…`;
}

/**
 * Resuelve un hueco de portada del manifiesto contra los claims de una ficha.
 *
 * El agente propone nombres de campo mirando la API de entidades
 * (`headquarters_address`), pero los claims de una ficha vienen del dossier de
 * la consulta (`city`, `funding`). En vez de cablear una tabla de equivalencias
 * por dominio, se deduce la ESTRATEGIA de extracción del propio nombre del
 * campo: dónde vive, cuánto levantó, cuándo, un enlace, o texto libre.
 *
 * `used` es lo que ya cantaron los huecos anteriores: dos rótulos distintos
 * repitiendo la misma frase es peor que un hueco vacío.
 */
export function coverValue(
  claims: Claim[],
  slot: { fields: string[] },
  used?: Set<Claim>,
  allowProse = true,
) {
  const pool = own(claims, used).filter((claim) => allowProse || !isProse(claim));
  const exact = firstByKeys(pool, slot.fields);
  if (exact) return exact;

  const hint = slot.fields.join(" ").toLocaleLowerCase("en");
  const match = (...words: string[]) => words.some((word) => hint.includes(word));

  // La tesis va antes que el dinero: "investment_stage" habla de etapa, no de
  // importe, y si el dinero mirase primero se llevaría el hueco por la palabra.
  if (match("stage", "thesis", "focus", "tesis", "sector", "industry")) return firstByKeys(pool, DESCRIPTION_KEYS);
  if (match("funding", "raised", "amount", "capital", "money", "valuation", "ticket")) return moneyFromClaims(pool);
  if (match("address", "location", "city", "country", "headquarters", "region")) return placeFromClaims(pool);
  if (match("date", "founding", "founded", "year")) {
    return pool.find((claim) => claim.date) ?? pool.find((claim) => /\b(19|20)\d{2}\b/.test(claim.value));
  }
  if (match("website", "url", "linkedin", "github", "domain")) {
    return pool.find((claim) => /https?:\/\/|\.[a-z]{2,}\//i.test(claim.value) || /\.(com|es|io|ai|org)\b/i.test(claim.value));
  }
  return firstByKeys(pool, DESCRIPTION_KEYS);
}

/**
 * El dorso del expediente. Los campos los pide el manifiesto (`back.fields`);
 * si no dice nada, valen los descriptivos de siempre. Nunca repite lo que la
 * portada ya enseñó: hojear tiene que dar algo nuevo o no vale la pena.
 */
export function descriptionFromClaims(claims: Claim[], fields?: string[], used?: Set<Claim>) {
  const pool = own(claims, used);
  return firstByKeys(pool, fields?.length ? fields : DESCRIPTION_KEYS)
    ?? firstByKeys(pool, DESCRIPTION_KEYS)
    ?? pool.find((claim) => claim.value.trim());
}

export type CoverSlot = { label: string; fields: string[]; fallback: string };

/**
 * Reparte los claims de una ficha entre los huecos de portada del manifiesto.
 *
 * Dos reglas, y las dos vienen de mirar fichas reales:
 *  · un dato no se repite —dos rótulos distintos cantando la misma frase es
 *    peor que un hueco vacío—, y
 *  · la prosa ocupa como mucho UN hueco, el último que la pida: los agentes
 *    ponen "description" como comodín al final de varias listas, y sin esta
 *    regla la descripción de una empresa acaba bajo el rótulo "tipo de
 *    inversor".
 * Lo que la portada solo insinúa sigue entero al dorso.
 */
export function buildCover(claims: Claim[], slots: CoverSlot[], backFields?: string[]) {
  const spent = new Set<Claim>();
  const lines: Array<{ slot: CoverSlot; claim?: Claim }> = slots.map((slot) => {
    const claim = coverValue(claims, slot, spent, false);
    if (claim) spent.add(claim);
    return { slot, claim };
  });

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].claim) continue;
    const claim = coverValue(claims, lines[index].slot, spent, true);
    if (!claim) continue;
    lines[index] = { ...lines[index], claim };
    spent.add(claim);
    break;
  }

  // El dorso puede repetir la prosa que la portada solo insinuó: ahí es donde
  // se lee entera. Lo que no repite son los datos cortos ya cantados.
  const short = new Set([...spent].filter((claim) => !isProse(claim)));
  return { lines, back: descriptionFromClaims(claims, backFields, short) };
}
