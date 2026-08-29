import { CASE_RELATION } from "@/lib/relations";
import type { Edge, EntityCard, ResearchCase } from "@/lib/types";

/**
 * Reconstruye la cadena realmente recorrida hasta una ficha.
 *
 * Los hilos pueden formar ciclos y una entidad puede reaparecer con otro UUID;
 * `parentId`, en cambio, se escribe justo cuando una pista nace de otra ficha.
 * Por eso es la fuente de verdad para compartir el camino y no un BFS sobre
 * todas las aristas visibles del tablero.
 */
export function investigationTrail(graph: ResearchCase, targetId: string): EntityCard[] {
  const byId = new Map(graph.cards.map((card) => [card.id, card]));
  const reversed: EntityCard[] = [];
  const seen = new Set<string>();
  let current = byId.get(targetId);

  while (current && !seen.has(current.id)) {
    reversed.push(current);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return reversed.reverse();
}

/** Solo los hilos que explican cada salto consecutivo del recorrido. */
export function investigationTrailEdges(graph: ResearchCase, targetId: string): Edge[] {
  const trail = investigationTrail(graph, targetId);
  const ids = [graph.focus.id, ...trail.map((card) => card.id)];
  const edges: Edge[] = [];

  for (let index = 1; index < ids.length; index += 1) {
    const sourceId = ids[index - 1];
    const target = trail[index - 1];
    const edge = graph.edges.find((item) => item.sourceId === sourceId && item.targetId === target.id)
      ?? (index === 1
        ? graph.edges.find((item) => item.targetId === target.id && item.relationType === CASE_RELATION)
        : undefined);
    if (edge) edges.push(edge);
  }

  return edges;
}

function compactCard(card: EntityCard) {
  return {
    id: card.id,
    name: card.name,
    entityType: card.entityType,
    category: card.category,
    density: card.density,
  };
}

/**
 * Contexto explícito y acotado que sale del navegador hacia Pioneer.
 * Es JSON de investigación, no HTML ni texto de prompt ensamblado en cliente.
 */
export function buildPotentialQuestionContext(graph: ResearchCase, targetId: string) {
  const currentNode = graph.cards.find((card) => card.id === targetId);
  if (!currentNode) return undefined;
  const trail = investigationTrail(graph, targetId).slice(-12);
  const trailEdges = investigationTrailEdges(graph, targetId);
  // Las preguntas que ya salieron de esta ficha son parte de su historia,
  // aunque no estén en la cadena de padres que conduce hasta ella. Enviarlas
  // evita que una recarga vuelva a proponer exactamente el mismo borrador.
  const previousQuestions = [...new Map(
    graph.edges
      .filter((edge) => edge.sourceId === targetId && edge.question)
      .map((edge) => [edge.question, edge]),
  ).values()];
  const relevantEdges = [...new Map(
    [...trailEdges, ...previousQuestions].map((edge) => [edge.id, edge]),
  ).values()].slice(-12);
  const claims = [...currentNode.claims]
    .sort((a, b) => Number(Boolean(a.mention)) - Number(Boolean(b.mention)))
    .slice(0, 12)
    .map((claim) => ({
      key: claim.key,
      label: claim.label,
      value: claim.value,
      date: claim.date,
      mention: claim.mention ?? false,
      source: {
        label: claim.source.label,
        query: claim.source.query,
        runAt: claim.source.runAt,
      },
    }));

  return {
    case: {
      id: graph.id,
      title: graph.title,
      question: graph.focus.title,
      query: graph.focus.query,
      finding: graph.focus.finding,
    },
    currentNode: {
      ...compactCard(currentNode),
      claims,
      relations: currentNode.relations.map((relation) => ({
        type: relation.type,
        count: relation.count,
      })),
    },
    trail: trail.map(compactCard),
    edges: relevantEdges.map((edge) => ({
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      relationType: edge.relationType,
      question: edge.question,
    })),
  };
}
