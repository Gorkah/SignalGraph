import { createClient, LiveList, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import type { Point } from "@/lib/types";

/** Una nota compartida: texto libre que un colaborador clava junto a una ficha del caso. */
export type NotaPayload = {
  id: string;
  cardId: string;
  text: string;
  author: string;
  color: string;
  position: Point;
  createdAt: number;
};

type Presence = {
  cursor: Point | null;
  // En Presence (no en el userInfo del token) para que cada uno pueda
  // cambiarse el nombre en directo sin volver a autenticar la sesión.
  name: string;
  color: string;
};

type Storage = {
  notas: LiveList<LiveObject<NotaPayload>>;
};

const client = createClient({ authEndpoint: "/api/liveblocks-auth" });

export const {
  RoomProvider,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useStorage,
  useMutation,
} = createRoomContext<Presence, Storage>(client);
