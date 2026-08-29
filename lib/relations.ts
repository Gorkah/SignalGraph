/**
 * La dirección que devuelve Cala no es fiable: el `INVESTED_IN` saliente de
 * Bnext apunta a sus inversores y el de BBVA Spark a sus participadas. Un
 * verbo dirigido dibujado sin flecha promete una dirección que la línea no
 * entrega, así que el hilo se nombra con un sustantivo simétrico.
 */
const NOUNS: Record<string, string> = {
  INVESTED_IN: "inversión",
  FINANCED: "financiación",
  OPERATES_IN_INDUSTRY: "sector",
  PARTICIPATES_IN_CORPORATE_EVENT: "operación",
  IS_MEMBER_OF: "pertenencia",
  HAS_PRESENCE_IN: "presencia",
  WORKS_AT: "vínculo laboral",
  FOUNDED: "fundación",
  IS_CEO_OF: "dirección",
  IS_CFO_OF: "dirección",
  IS_COO_OF: "dirección",
  DESIGNED_BY: "diseño",
  OPERATED_BY: "operación",
  REPORT_MATCH: "dossier",
  HAS_HEADQUARTERS_IN: "sede",
  IS_REGISTERED_IN: "registro",
  IS_CMO_OF: "dirección",
  IS_BENEFICIARY_OWNER_OF: "propiedad",
  IS_ULTIMATE_PARENT_OF: "matriz",
  IS_DIRECT_PARENT_OF: "matriz",
  PUBLISHED_BY: "publicación",
};

export const CASE_RELATION = "LÍNEA DE CASO";

/**
 * Los sustantivos del caso mandan sobre el mapa estático: el agente los decide
 * mirando qué relaciones aparecieron de verdad, y sabe de este dominio más que
 * una tabla escrita a mano. El mapa queda de red para lo que no previera.
 */
let caseNouns: Record<string, string> = {};

export function registerNouns(pairs?: Array<{ type: string; noun: string }>) {
  caseNouns = Object.fromEntries((pairs ?? []).map(({ type, noun }) => [type, noun]));
}

export function relationNoun(type: string) {
  return caseNouns[type] ?? NOUNS[type] ?? type.toLocaleLowerCase("es").replace(/_/g, " ");
}
