import "server-only";

import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Centralized API validation schemas
 */

export const ReportRequestSchema = z.object({
  input: z.string().min(1, "Query is required").max(500, "Query is too long"),
  mode: z.enum(["live", "cached"]).default("cached"),
});

export const ProjectionRequestSchema = z.object({
  projection: z.string().min(1, "Projection type is required").trim(),
  limit: z.number().int().min(1).max(8).default(8),
});

export const IntrospectionRequestSchema = z.object({
  // GET request, no body needed
});

export const PioneerRequestSchema = z.object({
  context: z.object({
    currentNodeId: z.string(),
    question: z.string(),
  }),
});

export const StoryRequestSchema = z.object({
  parentId: z.string(),
  dossier: z.object({
    candidates: z.array(z.any()),
    query: z.string(),
  }),
});

/**
 * Validate and parse request body with error logging
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>,
  operation: string,
): Promise<T> {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    logger.debug(`${operation}: validation passed`, { bodyKeys: Object.keys(body) });
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      logger.warn(`${operation}: validation failed`, { errors });
      throw new ValidationError("Invalid request", errors);
    }
    throw error;
  }
}

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public details: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Standardized error response builder
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  context?: Record<string, unknown>,
) {
  logger.error(`API error: ${code}`, undefined, { status, message, ...context });
  return Response.json({ error: message, code }, { status });
}
