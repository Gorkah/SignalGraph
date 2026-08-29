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
};

export const CASE_RELATION = "LÍNEA DE CASO";

export function relationNoun(type: string) {
  return NOUNS[type] ?? type.toLocaleLowerCase("es").replace(/_/g, " ");
}
