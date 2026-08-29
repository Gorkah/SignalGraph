import { CalaError, queryDossier } from "@/lib/cala";
import { ReportRequestSchema, errorResponse, validateRequest } from "@/app/api/middleware";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    logger.debug("Report query received");
    const input = await validateRequest(request, ReportRequestSchema, "POST /api/report");
    
    const dossier = await queryDossier(input.input, {
      timeoutMs: 120_000,
      forceLive: input.mode === "live",
    });
    
    logger.info("Report query completed", { 
      source: dossier.source,
      candidateCount: dossier.candidates.length,
    });
    return Response.json(dossier);
  } catch (error) {
    if (error instanceof CalaError) {
      return errorResponse(error.status, error.code, error.message);
    }
    logger.error("Report query failed", error);
    return errorResponse(500, "UPSTREAM_ERROR", "El archivo no pudo completar la consulta");
  }
}
