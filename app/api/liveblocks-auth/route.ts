import { Liveblocks } from "@liveblocks/node";
import { NextRequest, NextResponse } from "next/server";

/**
 * Sesión anónima por pestaña: cada visitante entra como invitado del caso,
 * sin cuentas — es un tablón compartido dentro del mismo enlace, no un
 * espacio con permisos por persona. El nombre y el color viven en la
 * Presence (ver liveblocks.config.ts), no aquí: así se pueden cambiar en
 * directo sin renovar el token.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Falta LIVEBLOCKS_SECRET_KEY en .env" }, { status: 500 });
  }
  const liveblocks = new Liveblocks({ secret: apiKey });

  const { room } = await request.json().catch(() => ({ room: undefined }));
  if (typeof room !== "string") {
    return NextResponse.json({ error: "room requerido" }, { status: 400 });
  }

  const userId = `guest-${Math.random().toString(36).slice(2, 8)}`;
  const session = liveblocks.prepareSession(userId);
  session.allow(room, session.FULL_ACCESS);

  const { status, body } = await session.authorize();
  return new NextResponse(body, { status });
}
