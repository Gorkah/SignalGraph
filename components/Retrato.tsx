/**
 * Retrato pixelado para la cabecera de cada ficha del tablón.
 *
 * Todo es SVG inline sobre una rejilla de 16x16 unidades: sin imágenes, sin
 * dependencias y sin curvas. Cada unidad es un pixel gordo (3px a tamaño 48),
 * así que las coordenadas son siempre enteras y `crispEdges` remata el efecto.
 */

import type { ReactNode } from "react";

const INK = "var(--ink)";
const PAPEL = "var(--paper)";
const CLARO = "var(--paper-bright)";

/** El acento sale de aquí; son los cuatro colores vivos del tablón. */
const PALETA = ["var(--red)", "var(--blue)", "var(--green)", "var(--yellow)"];

type Grupo = "persona" | "empresa" | "lugar" | "evento" | "expediente";

/**
 * Los tipos que devuelve la API no caben en cinco dibujos uno a uno, así que
 * se agrupan por lo que son en el tablón: quién, qué empresa, dónde, cuándo y
 * "lo demás". Las claves van en minúsculas para no depender del casing.
 */
const GRUPOS: Record<string, Grupo> = {
  person: "persona",
  organization: "empresa",
  company: "empresa",
  industry: "empresa",
  country: "lugar",
  municipality: "lugar",
  gpe: "lugar",
  event: "evento",
  privatecompanyfundinground: "evento",
  entity: "expediente",
  product: "expediente",
};

const ETIQUETAS: Record<Grupo, string> = {
  persona: "persona",
  empresa: "empresa",
  lugar: "lugar",
  evento: "evento",
  expediente: "expediente",
};

/**
 * djb2 sobre el nombre. Determinista a propósito: el mismo nombre tiene que
 * dar el mismo retrato en el servidor y en el cliente, o React se queja de la
 * hidratación. Por eso no hay ni un Math.random en todo el fichero.
 */
function hash(texto: string): number {
  let h = 5381;
  for (let i = 0; i < texto.length; i += 1) {
    h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

function persona(acento: string, variante: number) {
  const altoPelo = 1 + (variante % 2);
  return (
    <>
      <rect x={4} y={2} width={8} height={7} fill={INK} />
      <rect x={5} y={4} width={6} height={4} fill={PAPEL} />
      <rect x={5} y={4 - altoPelo} width={6} height={altoPelo} fill={acento} />
      <rect x={6} y={5} width={1} height={1} fill={INK} />
      <rect x={9} y={5} width={1} height={1} fill={INK} />
      <rect x={7} y={7} width={2} height={1} fill={INK} />
      <rect x={6} y={9} width={4} height={1} fill={INK} />
      <rect x={3} y={10} width={10} height={5} fill={INK} />
      <rect x={7} y={10} width={2} height={5} fill={acento} />
    </>
  );
}

/** Ventanas del edificio, en unidades de rejilla. */
const VENTANAS = [
  [4, 5],
  [7, 5],
  [10, 5],
  [4, 8],
  [7, 8],
  [10, 8],
];

function empresa(acento: string, variante: number) {
  // Una sola ventana encendida, siempre la misma para el mismo nombre.
  const encendida = variante % VENTANAS.length;
  return (
    <>
      <rect x={2} y={2} width={12} height={2} fill={acento} />
      <rect x={3} y={4} width={10} height={11} fill={INK} />
      {VENTANAS.map(([x, y], i) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={2} height={2} fill={i === encendida ? acento : PAPEL} />
      ))}
      <rect x={7} y={11} width={2} height={4} fill={PAPEL} />
    </>
  );
}

function lugar(acento: string, variante: number) {
  // Chincheta de mapa: la cabeza se hace por bandas (un círculo creíble en
  // rejilla) y baja en punta hasta el suelo. Un globo terráqueo con manchas
  // acababa leyéndose como una cara.
  const guijarro = 3 + (variante % 4);
  return (
    <>
      <rect x={5} y={2} width={6} height={1} fill={acento} />
      <rect x={4} y={3} width={8} height={1} fill={acento} />
      <rect x={3} y={4} width={10} height={4} fill={acento} />
      <rect x={4} y={8} width={8} height={1} fill={acento} />
      <rect x={5} y={9} width={6} height={1} fill={acento} />
      <rect x={6} y={10} width={4} height={1} fill={acento} />
      <rect x={7} y={11} width={2} height={2} fill={acento} />
      <rect x={6} y={4} width={4} height={3} fill={INK} />
      {/* El suelo va a media altura de la fila de abajo: pegado al marco se
          leía como un borde más gordo y la chincheta no se plantaba en nada. */}
      <rect x={3} y={13} width={10} height={1} fill={INK} />
      <rect x={guijarro} y={12} width={1} height={1} fill={INK} />
      <rect x={12 - (variante % 3)} y={12} width={1} height={1} fill={INK} />
    </>
  );
}

/** Días marcables del calendario. */
const DIAS = [
  [5, 8],
  [8, 8],
  [5, 11],
  [8, 11],
];

function evento(acento: string, variante: number) {
  const marcado = variante % DIAS.length;
  return (
    <>
      <rect x={5} y={1} width={1} height={2} fill={INK} />
      <rect x={10} y={1} width={1} height={2} fill={INK} />
      <rect x={3} y={3} width={10} height={12} fill={INK} />
      <rect x={4} y={4} width={8} height={2} fill={acento} />
      <rect x={4} y={6} width={8} height={8} fill={CLARO} />
      {DIAS.map(([x, y], i) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={2} height={2} fill={i === marcado ? acento : INK} />
      ))}
    </>
  );
}

function expediente(acento: string, variante: number) {
  const anchoLinea = 3 + (variante % 4);
  return (
    <>
      <rect x={3} y={3} width={5} height={2} fill={acento} />
      <rect x={2} y={5} width={12} height={10} fill={INK} />
      <rect x={4} y={7} width={8} height={6} fill={CLARO} />
      <rect x={5} y={8} width={6} height={1} fill={INK} />
      <rect x={5} y={10} width={anchoLinea} height={1} fill={INK} />
      <rect x={2} y={13} width={12} height={2} fill={acento} />
    </>
  );
}

const DIBUJOS: Record<Grupo, (acento: string, variante: number) => ReactNode> = {
  persona,
  empresa,
  lugar,
  evento,
  expediente,
};

export function Retrato({
  entityType,
  name,
  size = 48,
}: {
  entityType: string;
  name: string;
  size?: number;
}) {
  const grupo = GRUPOS[(entityType ?? "").toLowerCase()] ?? "expediente";
  const semilla = hash(name);
  const acento = PALETA[semilla % PALETA.length];
  // Un segundo tramo del hash para el detalle: dos retratos del mismo tipo y
  // del mismo color siguen sin salir idénticos.
  const variante = (semilla >>> 4) % 12;

  return (
    <svg
      className="retrato"
      role="img"
      aria-label={`Retrato pixelado de ${name} (${ETIQUETAS[grupo]})`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={16} height={16} fill={INK} />
      <rect x={1} y={1} width={14} height={14} fill={CLARO} />
      {DIBUJOS[grupo](acento, variante)}
    </svg>
  );
}
