import { CalaError, introspectEntity } from "@/lib/cala";
import { errorResponse } from "@/app/api/middleware";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    logger.debug("Introspection request", { entityId: id });
    
    const result = await introspectEntity(id);
    logger.info("Introspection completed", { entityId: id, relationCount: result.relations?.length ?? 0 });
    return Response.json(result);
  } catch (error) {
    const { id } = await context.params;
    if (error instanceof CalaError) {
      return errorResponse(error.status, error.code, error.message, { entityId: id });
    }
    logger.error("Introspection failed", error, { entityId: id });
    return errorResponse(500, "UPSTREAM_ERROR", "No se pudo abrir la ficha");
  }
}
