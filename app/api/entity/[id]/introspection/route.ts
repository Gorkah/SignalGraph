import { CalaError, introspectEntity } from "@/lib/cala";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return Response.json(await introspectEntity(id));
  } catch (error) {
    if (error instanceof CalaError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: "No se pudo abrir la ficha", code: "UPSTREAM_ERROR" }, { status: 500 });
  }
}
