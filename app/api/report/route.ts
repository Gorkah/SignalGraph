import { CalaError, queryDossier } from "@/lib/cala";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { input?: unknown; mode?: unknown };
    if (typeof body.input !== "string") {
      return Response.json({ error: "Falta la consulta", code: "BAD_REQUEST" }, { status: 400 });
    }
    const dossier = await queryDossier(body.input, {
      timeoutMs: 120_000,
      forceLive: body.mode === "live",
    });
    return Response.json(dossier);
  } catch (error) {
    if (error instanceof CalaError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: "El archivo no pudo completar la consulta", code: "UPSTREAM_ERROR" }, { status: 500 });
  }
}
