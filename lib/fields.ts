import type { Claim, EntityCard, SelectorMode } from "@/lib/types";

// Las unidades van de más larga a más corta: si `m` va primero se come la
// "m" de "million" y deja "€83 m". El importe se muestra como cita textual
// —incluido el "over" o el "up to"—, nunca como número parseado.
const AMOUNT = String.raw`(?:€|\$|£|US\$)\s?\d+(?:[.,]\d+)?\s?(?:billion|million|bn|k|m)?\b`;
const MONEY_PATTERN = new RegExp(
  String.raw`(?:over|up to|about|around|approx\.?|~)?\s*${AMOUNT}(?:\s?[–-]\s?${AMOUNT})?`,
  "i",
);

const MONEY_KEYS = ["funding", "notable_funding", "total_key_round"];

const DESCRIPTION_KEYS = ["description", "focus", "details", "notable_details", "notable_funding", "type"];
const CITY_KEYS = ["city", "location"];

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

export function latestClaim(claims: Claim[]) {
  return claims
    .filter((claim) => claim.date && !Number.isNaN(Date.parse(claim.date)))
    .sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!))[0];
}

export function visibleClaim(card: Pick<EntityCard, "claims">, selector: SelectorMode) {
  if (selector === "money") return moneyFromClaims(card.claims);
  if (selector === "city") return firstByKeys(card.claims, CITY_KEYS);
  if (selector === "latest") return latestClaim(card.claims);
  return firstByKeys(card.claims, DESCRIPTION_KEYS) ?? card.claims[0];
}

export function selectorLabel(selector: SelectorMode) {
  return {
    description: "descripción",
    money: "dinero",
    city: "ciudad",
    latest: "lo último",
  }[selector];
}
