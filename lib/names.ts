const LEGAL_SUFFIXES = [
  "socimisa",
  "socimisl",
  "limited",
  "company",
  "incorporated",
  "plc",
  "llc",
  "ltd",
  "slu",
  "sl",
  "sa",
];

/**
 * Identidad nominal conservadora para un grafo que mezcla nombres comerciales
 * y razones sociales. Solo quita diacríticos, puntuación y UN sufijo jurídico
 * final: `Neinor Homes` y `NEINOR HOMES SA` coinciden, pero dos marcas parecidas
 * no se fusionan por contener las mismas palabras.
 */
export function entityNameKey(value: string) {
  const compact = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "");
  const suffix = LEGAL_SUFFIXES.find((candidate) => compact.endsWith(candidate));
  return suffix ? compact.slice(0, -suffix.length) : compact;
}
