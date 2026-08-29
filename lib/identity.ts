"use client";

const KEY = "sg-guest-identity";
const COLORS = ["#e0c341", "#5fb0d6", "#e0785a", "#7fc99b", "#c98fd6"];

export type GuestIdentity = { name: string; color: string };

function randomIdentity(): GuestIdentity {
  // Sin nombre inventado: el color ya distingue el cursor en el tablón, y el
  // nombre se pide de verdad en cuanto hay alguien más con quien compartirlo.
  return {
    name: "",
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

/** Identidad por pestaña: sessionStorage la mantiene entre refrescos y la
 *  separa de otras pestañas, que es justo lo que hace única a cada cursor. */
export function loadIdentity(): GuestIdentity {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as GuestIdentity;
  } catch {
    // sessionStorage bloqueado (privado/embebido): identidad de usar y tirar.
  }
  const identity = randomIdentity();
  saveIdentity(identity);
  return identity;
}

export function saveIdentity(identity: GuestIdentity) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Nada que guardar si no hay storage: la pestaña sigue funcionando.
  }
}
