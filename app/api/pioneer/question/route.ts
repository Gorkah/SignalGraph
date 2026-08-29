import { PioneerError, suggestPotentialQuestion } from "@/lib/pioneer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json(await suggestPotentialQuestion(body));
  } catch (error) {
    if (error instanceof PioneerError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "El cuerpo debe ser JSON válido" }, { status: 400 });
    }
    return Response.json({ error: "No se pudo evaluar la siguiente pregunta" }, { status: 500 });
  }
}
