import { CalaError, projectEntity } from "@/lib/cala";
import { ProjectionRequestSchema, errorResponse, validateRequest } from "@/app/api/middleware";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    logger.debug("Projection query received", { entityId: id });
    
    const input = await validateRequest(request, ProjectionRequestSchema, "POST /api/entity/:id");
    const limit = Math.min(8, Math.max(1, input.limit));
    
    const result = await projectEntity(id, input.projection, limit);
    logger.info("Projection completed", { entityId: id, relationType: input.projection });
    return Response.json(result);
  } catch (error) {
    if (error instanceof CalaError) {
      return errorResponse(error.status, error.code, error.message, { entityId: (await context.params).id });
    }
    logger.error("Projection failed", error, { entityId: (await context.params).id });
    return errorResponse(500, "UPSTREAM_ERROR", "No se pudo tirar del hilo");
  }
}
