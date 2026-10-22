// Pixel-art version of the Digit@l Solutions logo (public/brand/).
// Run with: npm run brand:generate
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const COLORS = { b: "#1d4ed8", g: "#16a34a", n: "#1e3a8a", o: "#f97316", r: "#dc2626" };

// 16×16 emblem composed from bold 2-px letters: blue "DS", red swoosh and
// the two colored service dots of the original logo.
const LETTER_D = ["bbbb..", "bb.bb.", "bb..bb", "bb..bb", "bb..bb", "bb..bb", "bb..bb", "bb..bb", "bb..bb", "bb.bb.", "bbbb.."];
const LETTER_S = [".bbbbbb", "bb.....", "bb.....", "bb.....", "bb.....", ".bbbbb.", ".....bb", ".....bb", ".....bb", ".....bb", "bbbbbb."];
const EMBLEM = [
  "..............og",
  "..............go",
  ...LETTER_D.map((row, i) => `${row}.${LETTER_S[i]}..`),
  ".rrrrrrrrrrrrrrr",
  "..........rrrr..",
  "................",
];

// Pixel font: x-height 5, cap height 7 and 2 descender rows (9 rows total).
const pad = (rows) => [...rows, ".".repeat(rows[0].length), ".".repeat(rows[0].length)];
const FONT = {
  " ": pad(["...", "...", "...", "...", "...", "...", "..."]),
  "@": pad([".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."]),
  D: pad(["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."]),
  S: pad([".####", "#....", "#....", ".###.", "....#", "....#", "####."]),
  g: ["....", "....", ".###", "#..#", "#..#", "#..#", ".###", "...#", ".##."],
  i: pad(["#", ".", "#", "#", "#", "#", "#"]),
  l: pad(["#", "#", "#", "#", "#", "#", "#"]),
  n: pad(["....", "....", "###.", "#..#", "#..#", "#..#", "#..#"]),
  o: pad(["....", "....", ".##.", "#..#", "#..#", "#..#", ".##."]),
  s: pad(["....", "....", ".###", "#...", ".##.", "...#", "###."]),
  t: pad([".#.", "###", ".#.", ".#.", ".#.", ".#.", "..#"]),
  u: pad(["....", "....", "#..#", "#..#", "#..#", "#..#", ".###"]),
};

const WORDMARK = "Digit@l Solutions";

function rects(rows, offsetX, offsetY, colorFor) {
  const out = [];

  rows.forEach((row, y) => {
    let x = 0;

    while (x < row.length) {
      const color = colorFor(row[x]);

      if (!color) {
        x += 1;
        continue;
      }

      let end = x;

      while (end + 1 < row.length && colorFor(row[end + 1]) === color) {
        end += 1;
      }

      out.push(`<rect x="${offsetX + x}" y="${offsetY + y}" width="${end - x + 1}" height="1" fill="${color}"/>`);
      x = end + 1;
    }
  });

  return out;
}

export function renderBrandSvg() {
  const parts = rects(EMBLEM, 0, 0, (symbol) => COLORS[symbol] ?? null);
  let cursor = 19;

  for (const character of WORDMARK) {
    const glyph = FONT[character];

    if (!glyph) {
      throw new Error(`Falta el glifo «${character}».`);
    }

    parts.push(...rects(glyph, cursor, 4, (symbol) => (symbol === "#" ? COLORS.n : null)));
    cursor += glyph[0].length + 1;
  }

  const width = cursor - 1;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 16" width="${width * 4}" height="64" shape-rendering="crispEdges" role="img" aria-label="Digit@l Solutions">`,
    ...parts,
    "</svg>",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = resolve(import.meta.dirname, "..", "public", "brand");
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "digital-solutions.svg"), renderBrandSvg());
  console.log("Logo generado en public/brand/digital-solutions.svg");
}
