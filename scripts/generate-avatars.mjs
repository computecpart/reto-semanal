// Genera los avatares genéricos pixel-art de public/avatars/.
// Son diseños originales construidos por capas; no representan personajes
// protegidos. Ejecutar con: node scripts/generate-avatars.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SIZE = 16;
const OUTLINE = "#1e1b2e";
const EYE = "#1e1b2e";

export const AVATAR_SPECS = [
  { id: "avatar-01", bg: "#bae6fd", skin: "#f5d0b5", hair: "#6b3f1d", hairStyle: "short", shirt: "#2563eb" },
  { id: "avatar-02", bg: "#fed7aa", skin: "#d6a07a", hair: "#1f1a17", hairStyle: "long", shirt: "#dc2626" },
  { id: "avatar-03", bg: "#bbf7d0", skin: "#c68b5e", hair: "#9a3412", hairStyle: "bun", shirt: "#15803d", glasses: true },
  { id: "avatar-04", bg: "#ddd6fe", skin: "#8d5a3b", hair: "#1f1a17", hairStyle: "cap", accent: "#f97316", shirt: "#eab308" },
  { id: "avatar-05", bg: "#99f6e4", skin: "#f1c7a8", hair: "#3f2a1d", hairStyle: "beanie", accent: "#7c3aed", shirt: "#0f766e" },
  { id: "avatar-06", bg: "#fef08a", skin: "#5e3a26", hair: "#14110f", hairStyle: "curly", shirt: "#ea580c" },
  { id: "avatar-07", bg: "#fecaca", skin: "#f8d9c0", hair: "#facc15", hairStyle: "spiky", shirt: "#1e3a8a" },
  { id: "avatar-08", bg: "#a5f3fc", skin: "#b9805a", hair: "#111827", hairStyle: "headband", accent: "#e11d48", shirt: "#475569" },
  { id: "avatar-09", bg: "#1e293b", skin: "#94a3b8", hair: "#64748b", hairStyle: "antenna", accent: "#f43f5e", eye: "#22d3ee", mouth: "grille", shirt: "#334155", ears: false },
  { id: "avatar-10", bg: "#fbcfe8", skin: "#f3c9a6", hair: "#eab308", hairStyle: "long", shirt: "#db2777", glasses: true },
  { id: "avatar-11", bg: "#e7e5e4", skin: "#c99572", hair: "#d4d4d8", hairStyle: "short", shirt: "#78350f", glasses: true },
  { id: "avatar-12", bg: "#312e81", skin: "#86efac", hair: "#4ade80", hairStyle: "alien", accent: "#fde047", eye: "#14532d", shirt: "#a855f7", ears: false },
];

function createCanvas() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
}

function fill(canvas, row, fromCol, toCol, color) {
  for (let col = fromCol; col <= toCol; col += 1) {
    canvas[row][col] = color;
  }
}

function fillRect(canvas, fromRow, toRow, fromCol, toCol, color) {
  for (let row = fromRow; row <= toRow; row += 1) {
    fill(canvas, row, fromCol, toCol, color);
  }
}

function drawHair(canvas, spec) {
  const { accent, hair, hairStyle } = spec;

  switch (hairStyle) {
    case "short":
      fillRect(canvas, 3, 4, 4, 11, hair);
      fill(canvas, 5, 4, 5, hair);
      fill(canvas, 5, 10, 11, hair);
      break;
    case "long":
      fillRect(canvas, 3, 4, 4, 11, hair);
      fill(canvas, 5, 4, 6, hair);
      fill(canvas, 5, 10, 11, hair);
      fillRect(canvas, 4, 12, 3, 3, hair);
      fillRect(canvas, 4, 12, 12, 12, hair);
      break;
    case "bun":
      fillRect(canvas, 1, 2, 7, 8, hair);
      fillRect(canvas, 3, 4, 4, 11, hair);
      fill(canvas, 5, 4, 4, hair);
      fill(canvas, 5, 11, 11, hair);
      break;
    case "cap":
      fillRect(canvas, 2, 4, 4, 11, accent);
      fill(canvas, 5, 9, 13, accent);
      fill(canvas, 5, 4, 5, hair);
      break;
    case "beanie":
      fillRect(canvas, 1, 1, 7, 8, "#f8fafc");
      fillRect(canvas, 2, 4, 4, 11, accent);
      fill(canvas, 5, 4, 11, "#f8fafc");
      break;
    case "curly":
      fillRect(canvas, 1, 2, 5, 10, hair);
      fillRect(canvas, 3, 5, 3, 12, hair);
      fillRect(canvas, 6, 7, 3, 3, hair);
      fillRect(canvas, 6, 7, 12, 12, hair);
      break;
    case "spiky":
      fill(canvas, 1, 5, 5, hair);
      fill(canvas, 1, 8, 8, hair);
      fill(canvas, 1, 11, 11, hair);
      fill(canvas, 2, 4, 11, hair);
      fillRect(canvas, 3, 4, 4, 11, hair);
      fill(canvas, 5, 4, 4, hair);
      fill(canvas, 5, 11, 11, hair);
      break;
    case "headband":
      fillRect(canvas, 3, 4, 4, 11, hair);
      fill(canvas, 5, 4, 11, accent);
      fill(canvas, 6, 3, 3, accent);
      break;
    case "antenna":
      fill(canvas, 1, 7, 8, accent);
      fillRect(canvas, 2, 3, 7, 8, hair);
      fill(canvas, 4, 4, 11, hair);
      break;
    case "alien":
      fill(canvas, 1, 4, 4, accent);
      fill(canvas, 1, 11, 11, accent);
      fill(canvas, 2, 5, 5, hair);
      fill(canvas, 2, 10, 10, hair);
      fill(canvas, 3, 6, 6, hair);
      fill(canvas, 3, 9, 9, hair);
      break;
    default:
      throw new Error(`Estilo de cabello desconocido: ${hairStyle}`);
  }
}

function drawFace(canvas, spec) {
  const eye = spec.eye ?? EYE;

  if (spec.mouth === "grille") {
    fill(canvas, 7, 5, 10, "#0f172a");
    fill(canvas, 8, 6, 6, eye);
    fill(canvas, 8, 9, 9, eye);
    fill(canvas, 10, 6, 9, "#475569");
    fill(canvas, 10, 7, 7, "#cbd5e1");
    fill(canvas, 10, 9, 9, "#cbd5e1");
    return;
  }

  if (spec.hairStyle === "alien") {
    fillRect(canvas, 7, 8, 5, 6, eye);
    fillRect(canvas, 7, 8, 9, 10, eye);
    fill(canvas, 7, 5, 5, "#f0fdf4");
    fill(canvas, 7, 9, 9, "#f0fdf4");
    fill(canvas, 10, 7, 8, "#166534");
    return;
  }

  fill(canvas, 8, 6, 6, eye);
  fill(canvas, 8, 9, 9, eye);
  fill(canvas, 9, 5, 5, "#f9a8a8");
  fill(canvas, 9, 10, 10, "#f9a8a8");
  fill(canvas, 10, 7, 8, "#9f1239");

  if (spec.glasses) {
    const frame = "#57534e";
    fill(canvas, 7, 5, 10, frame);
    fill(canvas, 8, 5, 5, frame);
    fill(canvas, 8, 7, 8, frame);
    fill(canvas, 8, 10, 10, frame);
  }
}

export function renderAvatarPixels(spec) {
  const canvas = createCanvas();

  fillRect(canvas, 13, 15, 3, 12, spec.shirt);
  fill(canvas, 13, 7, 8, spec.skin);
  fill(canvas, 12, 6, 9, spec.skin);
  fillRect(canvas, 4, 11, 4, 11, spec.skin);

  if (spec.ears !== false) {
    fillRect(canvas, 7, 8, 3, 3, spec.skin);
    fillRect(canvas, 7, 8, 12, 12, spec.skin);
  }

  drawHair(canvas, spec);
  drawFace(canvas, spec);

  // A one-pixel outline around the silhouette gives the classic pixel-art read.
  const outlined = canvas.map((row) => [...row]);

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (canvas[row][col]) {
        continue;
      }

      const touchesFigure = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ].some(([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE && canvas[r][c]);

      if (touchesFigure) {
        outlined[row][col] = OUTLINE;
      }
    }
  }

  return outlined;
}

export function renderAvatarSvg(spec) {
  const pixels = renderAvatarPixels(spec);
  const rects = [];

  for (let row = 0; row < SIZE; row += 1) {
    let col = 0;

    while (col < SIZE) {
      const color = pixels[row][col];

      if (!color) {
        col += 1;
        continue;
      }

      let end = col;

      while (end + 1 < SIZE && pixels[row][end + 1] === color) {
        end += 1;
      }

      rects.push(
        `<rect x="${col}" y="${row}" width="${end - col + 1}" height="1" fill="${color}"/>`,
      );
      col = end + 1;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="128" height="128" shape-rendering="crispEdges">`,
    `<rect width="${SIZE}" height="${SIZE}" fill="${spec.bg}"/>`,
    ...rects,
    "</svg>",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputDirectory = resolve(import.meta.dirname, "..", "public", "avatars");
  mkdirSync(outputDirectory, { recursive: true });

  for (const spec of AVATAR_SPECS) {
    writeFileSync(resolve(outputDirectory, `${spec.id}.svg`), renderAvatarSvg(spec));
  }

  console.log(`Generados ${AVATAR_SPECS.length} avatares en ${outputDirectory}`);
}
