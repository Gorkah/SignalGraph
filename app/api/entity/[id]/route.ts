import { CalaError, projectEntity } from "@/lib/cala";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { projection?: unknown; limit?: unknown };
    if (typeof body.projection !== "string" || !body.projection.trim()) {
      return Response.json({ error: "Falta la proyección", code: "BAD_REQUEST" }, { status: 400 });
    }
    const limit = typeof body.limit === "number" ? Math.min(8, Math.max(1, Math.floor(body.limit))) : 8;
    return Response.json(await projectEntity(id, body.projection.trim(), limit));
  } catch (error) {
    if (error instanceof CalaError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: "No se pudo tirar del hilo", code: "UPSTREAM_ERROR" }, { status: 500 });
  }
}
