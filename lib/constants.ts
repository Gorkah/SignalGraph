/**
 * UI Timeouts and Durations
 */
export const UI_TIMEOUTS = {
  TOAST_DURATION_MS: 4200,
  FALLBACK_DELIVERY_MS: 90_000,
  RECEIPT_CHECK_INTERVAL_MS: 1000,
  REQUEST_TIMEOUT_MS: 120_000,
  API_RETRY_DELAY_MS: 2000,
  API_MAX_RETRIES: 2,
} as const;

/**
 * Grid and Layout
 */
export const LAYOUT = {
  GRID_SIZE: 16,
  GRID_PADDING_PX: 44,
  GRID_LEVELS: [
    { units: 1, rgb: "32 27 24", ink: 0.19 },   // 16px: el paso de encaje
    { units: 4, rgb: "255 248 223", ink: 0.26 }, // 64px: el relieve
    { units: 16, rgb: "32 27 24", ink: 0.18 },  // 256px: la retícula grande
  ],
} as const;

/**
 * Zoom constraints
 */
export const ZOOM = {
  MIN: 0.25,
  MAX: 2,
  STEP: 1.25,
} as const;

/**
 * Card dimensions
 */
export const CARD = {
  FULL_WIDTH: 296,
  FULL_HEIGHT: 184,
  LEAD_WIDTH: 128,
  LEAD_HEIGHT: 96,
  LEAD_STACK_HEIGHT: 80,
} as const;

/**
 * Debounce and throttle intervals
 */
export const TIMING = {
  DEBOUNCE_MS: 300,
  THROTTLE_MS: 100,
} as const;

/**
 * Cache configuration
 */
export const CACHE = {
  MAX_AGE_DAYS: 30,
  CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * Relation limits
 */
export const RELATIONS = {
  MAX_PULL_COUNT: 8,
  MAX_CANDIDATES_SHOWN: 8,
  MAX_CLAIMS_PER_CARD: 12,
} as const;

/**
 * Entity type defaults
 */
export const DEFAULTS = {
  COVER_SLOTS_MAX: 3,
  TEASER_MAX_LENGTH: 54,
} as const;

/**
 * Key codes for shortcuts
 */
export const KEYCODES = {
  FORCE_FALLBACK: "d",
} as const;
