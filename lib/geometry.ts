import type { CaseNode, EntityCard, Point, QuestionNode } from "@/lib/types";

export const GRID_SIZE = 16;
export const CARD_WIDTH = 240;
export const LEAD_WIDTH = 176;
export const LEAD_HEIGHT = 96;
export const CARD_HEIGHT = 240;
export const QUESTION_WIDTH = 272;
export const QUESTION_HEIGHT = 176;
export const CASE_WIDTH = 296;
export const CASE_HEIGHT = 184;
export const NOTE_WIDTH = 168;
export const NOTE_HEIGHT = 168;

export function snap(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function snapPoint(point: Point): Point {
  return { x: snap(point.x), y: snap(point.y) };
}

export function manhattanPath(start: Point, end: Point) {
  const middleX = snap((start.x + end.x) / 2);
  return `${start.x},${start.y} ${middleX},${start.y} ${middleX},${end.y} ${end.x},${end.y}`;
}


/**
 * Las chinchetas de un tirón se apilan en columna pegada a su ficha, del lado
 * que mira hacia afuera del caso. Un abanico las esparcía por el tablero y
 * obligaba a seguir un hilo largo para saber de dónde salían; en columna la
 * pertenencia se lee por proximidad y los hilos quedan cortos y paralelos.
 */
export function combPosition(origin: Point, away: Point, index: number, slots = 3): Point {
  const side = origin.x - away.x >= 0 ? 1 : -1;
  const column = Math.floor(index / slots);
  const slot = index % slots;
  const gap = CARD_WIDTH / 2 + 120 + column * (LEAD_WIDTH + 72);
  return snapPoint({
    x: side > 0 ? origin.x + gap : origin.x - gap - LEAD_WIDTH,
    // El paso vertical es la altura de la pista más aire: con el paso viejo,
    // calibrado para chinchetas de 24px, las fichas se comían unas a otras.
    y: origin.y + (slot - (slots - 1) / 2) * (LEAD_HEIGHT + 52),
  });
}

// El mazo cerrado no mide lo que la pista de encima: son tres hojas corridas
// 12px y un pie de "desplegar" debajo del cuerpo de 104px.
export const STACK_WIDTH = 208;
export const STACK_HEIGHT = 130;

/**
 * La cartera cerrada va al costado de su fondo y centrada con él. Reutilizar
 * `combPosition(…, 0)` la subía 148px, porque ese índice es el hueco de
 * arriba de la columna que aparecerá al desplegarla.
 */
export function portfolioPosition(origin: Point, away: Point): Point {
  const side = origin.x - away.x >= 0 ? 1 : -1;
  const gap = CARD_WIDTH / 2 + 120;
  return snapPoint({
    x: side > 0 ? origin.x + gap : origin.x - gap - LEAD_WIDTH,
    y: origin.y - STACK_HEIGHT / 2,
  });
}

/* ── Reparto del corcho ───────────────────────────────────────────────
   Todo lo que se clava ocupa una caja. Con las cajas sobre la mesa, colocar
   algo nuevo deja de ser adivinar coordenadas: es buscar dónde no hay nada. */

export type Box = Point & { w: number; h: number };

function boxAt(position: Point, w: number, h: number): Box {
  return { x: position.x, y: position.y, w, h };
}

export function boxCentre(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/**
 * Lo que ocupa una ficha, medido como se pinta: una pista de mazo cerrado se
 * dibuja como mazo —más ancho y más alto que la pista de encima— mientras no
 * lo despliegues.
 */
export function cardBox(card: EntityCard): Box {
  if (card.density !== "lead") return boxAt(card.position, CARD_WIDTH, CARD_HEIGHT);
  return card.stackId
    ? boxAt(card.position, STACK_WIDTH, STACK_HEIGHT)
    : boxAt(card.position, LEAD_WIDTH, LEAD_HEIGHT);
}

/**
 * Aire mínimo entre dos cosas clavadas. No es holgura estética: las sombras
 * duras llegan a 14px, la pregunta va girada un grado y el caso lleva halo,
 * así que dos cajas que se tocan justas ya se pisan en pantalla. Dos pasos
 * de rejilla cubren los tres casos.
 */
export const AIRE = GRID_SIZE * 2;

function overlaps(candidate: Box, other: Box, aire: number) {
  return candidate.x - aire < other.x + other.w
    && other.x < candidate.x + candidate.w + aire
    && candidate.y - aire < other.y + other.h
    && other.y < candidate.y + candidate.h + aire;
}

/** ¿Cabe esta caja aquí sin rozar nada de lo que ya está clavado? */
export function fitsFree(candidate: Box, occupied: Box[], aire = AIRE) {
  return !occupied.some((other) => overlaps(candidate, other, aire));
}

type BoardShape = {
  focus: CaseNode;
  cards: EntityCard[];
  questions?: QuestionNode[];
};

/**
 * Todo lo que ya ocupa sitio en el corcho, medido como se pinta. Es la única
 * lista: el encuadre y la colocación de preguntas leen la misma, así que no
 * pueden discrepar sobre dónde hay hueco. Las carteras cerradas entran aunque
 * hoy no se dibujen: el caso puede traerlas de vuelta.
 */
export function occupiedBoxes(board: BoardShape, _view?: unknown): Box[] {
  void _view;
  const { focus, cards, questions = [] } = board;
  const base = [
    boxAt(focus.position, CASE_WIDTH, CASE_HEIGHT),
    ...cards.map(cardBox),
    ...cards
      .filter((card) => card.density === "full" && !card.parentId)
      .map((card) => boxAt(
        portfolioPosition(
          boxCentre(boxAt(card.position, CARD_WIDTH, CARD_HEIGHT)),
          focus.position,
        ),
        STACK_WIDTH,
        STACK_HEIGHT,
      )),
    ...questions.map((question) => boxAt(question.position, QUESTION_WIDTH, QUESTION_HEIGHT)),
  ];
  return base;
}

// La búsqueda avanza de dos en dos pasos de rejilla: sigue cayendo en encaje
// válido y recorre el tablón entero en un pestañeo. El tope de anillos cubre
// ~1500px alrededor del sitio ideal, más que el diámetro de cualquier anillo.
const SEARCH_STEP = GRID_SIZE * 2;
const SEARCH_RINGS = 48;

/**
 * El hueco libre más cercano al sitio donde algo se quería poner. Se abre en
 * anillos cuadrados sobre la rejilla y devuelve el primer candidato que no
 * choca con nada, de modo que lo colocado se corre lo mínimo imprescindible.
 * Determinista y sin constantes afinadas a ojo: si el manifiesto cambia el
 * anillo, el hueco cambia con él.
 */
export function findFreeSlot(desired: Point, w: number, h: number, occupied: Box[], aire = AIRE): Point {
  const start = snapPoint(desired);
  const far = (point: Point) => (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  for (let ring = 0; ring <= SEARCH_RINGS; ring += 1) {
    const candidates: Point[] = [];
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        candidates.push({ x: start.x + dx * SEARCH_STEP, y: start.y + dy * SEARCH_STEP });
      }
    }
    // Empates: primero lo más cerca; luego lo de más abajo, que es hacia donde
    // crece el corcho; y a igualdad, la izquierda. Orden fijo = misma respuesta.
    candidates.sort((a, b) => far(a) - far(b) || b.y - a.y || a.x - b.x);
    const free = candidates.find((point) => fitsFree(boxAt(point, w, h), occupied, aire));
    if (free) return free;
  }
  return start;
}

/**
 * Las preguntas cuelgan del caso: en fila bajo su tarjeta y centradas con
 * ella, que es donde se leen como parte del expediente y no como fichas más.
 * Si el anillo ya ocupa ese sitio, cada una se corre al hueco libre más
 * cercano en vez de pintarse encima de una ficha.
 */
export function questionPositions(focus: Point, count: number, occupied: Box[]): Point[] {
  const row = count * QUESTION_WIDTH + Math.max(0, count - 1) * AIRE;
  const left = focus.x + CASE_WIDTH / 2 - row / 2;
  const taken = [...occupied];
  const positions: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const position = findFreeSlot(
      { x: left + index * (QUESTION_WIDTH + AIRE), y: focus.y + CASE_HEIGHT + AIRE },
      QUESTION_WIDTH,
      QUESTION_HEIGHT,
      taken,
    );
    positions.push(position);
    taken.push(boxAt(position, QUESTION_WIDTH, QUESTION_HEIGHT));
  }
  return positions;
}

// Una cascada más larga que esto deja de colgar del nodo y pasa a ser una
// columna suelta que cruza el tablón; a partir de ahí, segunda columna.
const CASCADE_ROWS = 5;

/**
 * Lo que cae de una pregunta aterriza en bloque justo debajo de ella. El hueco
 * se busca para el bloque entero, no pista a pista: así el grupo llega junto
 * —se lee de dónde salió sin seguir el hilo— en vez de desperdigarse por los
 * huecos sueltos que queden por el corcho.
 */
export function cascadePositions(question: Point, count: number, occupied: Box[]): Point[] {
  if (count <= 0) return [];
  const rows = Math.min(count, CASCADE_ROWS);
  const columns = Math.ceil(count / CASCADE_ROWS);
  const w = columns * LEAD_WIDTH + (columns - 1) * GRID_SIZE;
  const h = rows * LEAD_HEIGHT + (rows - 1) * GRID_SIZE;
  const origin = findFreeSlot(
    { x: question.x + QUESTION_WIDTH / 2 - w / 2, y: question.y + QUESTION_HEIGHT + AIRE },
    w,
    h,
    occupied,
  );
  return Array.from({ length: count }, (_, index) => ({
    x: origin.x + Math.floor(index / CASCADE_ROWS) * (LEAD_WIDTH + GRID_SIZE),
    y: origin.y + (index % CASCADE_ROWS) * (LEAD_HEIGHT + GRID_SIZE),
  }));
}

/**
 * Las respuestas forman una escalera narrativa alrededor del caso. Alternar
 * izquierda/derecha evita que varios Tab conviertan el relato en una línea
 * horizontal imposible de encajar en pantalla.
 */
export function narrativePosition(parent: Point, depth: number): Point {
  const direction = depth % 2 === 0 ? 1 : -1;
  return snapPoint({
    x: parent.x + direction * (CARD_WIDTH + 144),
    y: parent.y + CARD_HEIGHT + 112,
  });
}
