"use client";

import { investigationTrail, investigationTrailEdges } from "@/lib/investigation";
import { CASE_RELATION, relationNoun } from "@/lib/relations";
import type { Claim, ResearchCase } from "@/lib/types";

const WIDTH = 1600;
const SCALE = 2;
const CARD_W = 320;
const CARD_H = 196;
const COLS = 4;
const GRID = 16;

const PALETTE = {
  ink: "#201b18",
  paper: "#f1e8cf",
  bright: "#fff8df",
  board: "#c9b98f",
  red: "#d64b37",
  blue: "#2667a6",
  green: "#4d7f54",
  yellow: "#e1b53b",
  thread: "#574c3d",
  muted: "#8a7a5c",
};

type CanvasPoint = { x: number; y: number };

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "investigacion";
}

function shorten(value: string, max: number) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max - 1);
  return `${text.slice(0, cut > max / 2 ? cut : max - 1).trimEnd()}…`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const words = text.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= width || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ");
  if (consumed.length < text.trim().length && lines.length) {
    lines[lines.length - 1] = shorten(lines[lines.length - 1], Math.max(12, lines[lines.length - 1].length - 1));
  }
  return lines;
}

function drawGrid(ctx: CanvasRenderingContext2D, height: number) {
  ctx.fillStyle = PALETTE.board;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += GRID) {
    ctx.strokeStyle = x % (GRID * 4) === 0 ? "rgba(255,248,223,.25)" : "rgba(32,27,24,.10)";
    ctx.beginPath();
    ctx.moveTo(x + .5, 0);
    ctx.lineTo(x + .5, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += GRID) {
    ctx.strokeStyle = y % (GRID * 4) === 0 ? "rgba(255,248,223,.25)" : "rgba(32,27,24,.10)";
    ctx.beginPath();
    ctx.moveTo(0, y + .5);
    ctx.lineTo(WIDTH, y + .5);
    ctx.stroke();
  }
}

function drawHeader(ctx: CanvasRenderingContext2D, graph: ResearchCase, targetName: string) {
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, WIDTH, 112);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 108, WIDTH, 4);
  ctx.fillStyle = PALETTE.red;
  ctx.fillRect(34, 24, 64, 64);
  ctx.fillStyle = PALETTE.bright;
  ctx.font = "700 25px monospace";
  ctx.fillText("SG", 48, 65);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = "700 26px monospace";
  ctx.fillText("SIGNALGRAPH · RECORRIDO DE INVESTIGACIÓN", 122, 50);
  ctx.font = "20px monospace";
  ctx.fillText(shorten(graph.title, 92), 122, 82);
  ctx.textAlign = "right";
  ctx.font = "700 17px monospace";
  ctx.fillStyle = PALETTE.green;
  ctx.fillText(`NODO COMPARTIDO · ${shorten(targetName, 42)}`, WIDTH - 34, 51);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = "16px monospace";
  ctx.fillText(new Date().toLocaleString("es-ES"), WIDTH - 34, 79);
  ctx.textAlign = "left";
}

function cardPosition(index: number): CanvasPoint {
  const row = Math.floor(index / COLS);
  const inRow = index % COLS;
  const column = row % 2 === 0 ? inRow : COLS - 1 - inRow;
  const gapX = (WIDTH - 2 * 72 - COLS * CARD_W) / (COLS - 1);
  return { x: 72 + column * (CARD_W + gapX), y: 170 + row * 286 };
}

function drawThread(
  ctx: CanvasRenderingContext2D,
  start: CanvasPoint,
  end: CanvasPoint,
  label: string,
) {
  const from = { x: start.x + CARD_W / 2, y: start.y + CARD_H / 2 };
  const to = { x: end.x + CARD_W / 2, y: end.y + CARD_H / 2 };
  const middleX = Math.round((from.x + to.x) / 2 / GRID) * GRID;
  ctx.strokeStyle = PALETTE.thread;
  ctx.lineWidth = 5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(middleX, from.y);
  ctx.lineTo(middleX, to.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  const caption = shorten(label, 58);
  ctx.font = "700 14px monospace";
  const measured = Math.min(500, ctx.measureText(caption).width + 18);
  const labelX = (from.x + to.x) / 2;
  const labelY = (from.y + to.y) / 2 - 8;
  ctx.fillStyle = PALETTE.bright;
  ctx.fillRect(labelX - measured / 2, labelY - 16, measured, 22);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(labelX - measured / 2, labelY - 16, measured, 22);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = "center";
  ctx.fillText(caption, labelX, labelY);
  ctx.textAlign = "left";
}

function usefulClaims(claims: Claim[]) {
  const seen = new Set<string>();
  return claims
    .filter((claim) => !claim.mention && claim.value.trim())
    .filter((claim) => {
      const key = `${claim.key}:${claim.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function drawCard(ctx: CanvasRenderingContext2D, params: {
  position: CanvasPoint;
  title: string;
  subtitle: string;
  claims: Claim[];
  isCase: boolean;
  isCurrent: boolean;
  caseQuestion?: string;
}) {
  const { position, title, subtitle, claims, isCase, isCurrent, caseQuestion } = params;
  const { x, y } = position;
  ctx.fillStyle = "rgba(32,27,24,.62)";
  ctx.fillRect(x + 10, y + 10, CARD_W, CARD_H);
  ctx.fillStyle = PALETTE.bright;
  ctx.fillRect(x, y, CARD_W, CARD_H);
  ctx.strokeStyle = isCurrent ? PALETTE.green : PALETTE.ink;
  ctx.lineWidth = isCurrent ? 6 : 3;
  ctx.strokeRect(x, y, CARD_W, CARD_H);

  const band = isCase ? PALETTE.red : isCurrent ? PALETTE.green : PALETTE.ink;
  ctx.fillStyle = band;
  ctx.fillRect(x, y, CARD_W, 46);
  ctx.fillStyle = PALETTE.bright;
  ctx.font = "700 15px monospace";
  ctx.fillText(isCase ? "CASO ABIERTO" : isCurrent ? "NODO COMPARTIDO" : "NODO RECORRIDO", x + 12, y + 29);

  ctx.fillStyle = PALETTE.ink;
  ctx.font = "700 21px monospace";
  const titleLines = wrapLines(ctx, title, CARD_W - 24, 2);
  titleLines.forEach((line, index) => ctx.fillText(line, x + 12, y + 73 + index * 23));

  ctx.fillStyle = PALETTE.blue;
  ctx.font = "15px monospace";
  ctx.fillText(shorten(subtitle, 44), x + 12, y + 118);

  ctx.fillStyle = PALETTE.ink;
  ctx.font = "16px monospace";
  if (isCase) {
    const lines = wrapLines(ctx, caseQuestion ?? "", CARD_W - 24, 3);
    lines.forEach((line, index) => ctx.fillText(line, x + 12, y + 145 + index * 18));
    return;
  }

  usefulClaims(claims).forEach((claim, index) => {
    const lineY = y + 145 + index * 18;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${shorten(claim.label, 14)} ·`, x + 12, lineY);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(shorten(claim.value, 31), x + 112, lineY);
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo generar el PNG")), "image/png");
  });
}

/** Genera y descarga una lámina PNG sin enviar el tablero a ningún servicio. */
export async function downloadInvestigationPng(graph: ResearchCase, targetId: string) {
  const target = graph.cards.find((card) => card.id === targetId);
  if (!target) throw new Error("No hay un nodo actual para compartir");
  const trail = investigationTrail(graph, targetId);
  const edges = investigationTrailEdges(graph, targetId);
  const steps = [
    { id: graph.focus.id, title: graph.focus.title, subtitle: "pregunta de origen", claims: [] as Claim[], isCase: true },
    ...trail.map((card) => ({
      id: card.id,
      title: card.name,
      subtitle: card.category ?? card.entityType,
      claims: card.claims,
      isCase: false,
    })),
  ];
  const rows = Math.ceil(steps.length / COLS);
  const height = Math.max(720, 170 + rows * 286 + 100);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no permite generar la imagen");
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = false;
  await document.fonts?.ready;

  drawGrid(ctx, height);
  drawHeader(ctx, graph, target.name);
  const positions = steps.map((_, index) => cardPosition(index));
  for (let index = 1; index < steps.length; index += 1) {
    const edge = edges.find((item) => (
      item.sourceId === steps[index - 1].id && item.targetId === steps[index].id
    ));
    const label = edge?.question
      ? `Pregunta · ${edge.question}`
      : edge?.relationType === CASE_RELATION
        ? "procedencia del caso"
        : relationNoun(edge?.relationType ?? "continuación");
    drawThread(ctx, positions[index - 1], positions[index], label);
  }
  steps.forEach((step, index) => drawCard(ctx, {
    position: positions[index],
    title: step.title,
    subtitle: step.subtitle,
    claims: step.claims,
    isCase: step.isCase,
    isCurrent: step.id === targetId,
    caseQuestion: graph.focus.title,
  }));

  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, height - 58, WIDTH, 58);
  ctx.fillStyle = PALETTE.bright;
  ctx.font = "16px monospace";
  ctx.fillText(`${steps.length} nodos · ${Math.max(0, steps.length - 1)} saltos · ${shorten(graph.focus.query, 92)}`, 34, height - 24);
  ctx.textAlign = "right";
  ctx.fillText("signalgraph / evidencia recorrida", WIDTH - 34, height - 24);
  ctx.textAlign = "left";

  const blob = await canvasBlob(canvas);
  const url = URL.createObjectURL(blob);
  const filename = `signalgraph-${slug(target.name)}.png`;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return filename;
}
