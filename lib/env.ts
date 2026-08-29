import { z } from "zod";

const envSchema = z.object({
  CALA_API_KEY: z.string().min(1, "CALA_API_KEY is required"),
  CALA_BASE_URL: z.string().url().default("https://api.cala.ai"),
  CALA_TIMEOUT_MS: z.coerce.number().default(65000),
  CALA_LIVE: z.enum(["0", "1"]).default("1"),

  PIONEER_API_KEY: z.string().optional(),
  PIONEER_BASE_URL: z.string().url().optional(),
  PIONEER_MODEL: z.string().optional(),
  PIONEER_EMBEDDING_MODEL: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().default(60000),

  FAL_KEY: z.string().optional(),
  FAL_BASE_URL: z.string().url().optional(),
  FAL_MODEL: z.string().optional(),

  PROVIDER_TIMEOUT_MS: z.coerce.number().default(30000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CASE_SLUG: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

/**
 * Get validated environment variables
 * Throws if validation fails
 */
export function getEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/**
 * Validate environment on startup (only in server-side code)
 */
export function validateEnvOnStartup(): void {
  try {
    getEnv();
    console.log("✓ Environment variables validated");
  } catch (error) {
    console.error("✗ Environment validation failed:", error);
    process.exit(1);
  }
}
