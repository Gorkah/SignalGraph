/**
 * Centralized normalization utilities
 * Used across codebase for consistent string comparison
 */

/**
 * Normalize a string for comparison
 * - Convert to lowercase (en locale)
 * - Remove non-alphanumeric characters
 * Used to deduplicate entities across different data sources
 *
 * @example
 * normalizeKey("K-Fund") // => "kfund"
 * normalizeKey("BBVA Spark Fund") // => "bbvasparkfund"
 */
export function normalizeKey(value: string): string {
  return value.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "");
}

/**
 * Check if two names refer to the same entity
 * @example
 * sameName("K-Fund", "K Fund") // => true
 * sameName("Bnext", "BNext") // => true
 */
export function sameName(a: string, b: string): boolean {
  return normalizeKey(a) === normalizeKey(b);
}

/**
 * Find a value in an array by normalized matching
 * @example
 * findByNormalizedName("K Fund", ["K-Fund", "Kibo Ventures"]) // => "K-Fund"
 */
export function findByNormalizedName(target: string, items: string[]): string | undefined {
  const targetKey = normalizeKey(target);
  return items.find((item) => normalizeKey(item) === targetKey);
}
