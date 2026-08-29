import { NextResponse } from "next/server";
import { answerStory, StoryError } from "@/lib/story";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  try {
    const input = await request.json();
    return NextResponse.json(await answerStory(input));
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "El cuerpo debe ser JSON válido" }, { status: 400 });
    }
    console.error("story route", error);
    return NextResponse.json({ error: "No se pudo redactar la respuesta narrativa" }, { status: 500 });
  }
}
