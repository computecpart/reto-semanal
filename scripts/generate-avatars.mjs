// Generates the pixel-art avatars in public/avatars/. Original designs drawn on
// a 16×16 grid ("." = background); a 1-px outline is added automatically.
// Run with: npm run avatars:generate
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SIZE = 16;
const OUTLINE = "#1e1b2e";
const BASE_PALETTE = { k: "#1e1b2e", w: "#ffffff" };

export const AVATAR_SPECS = [
  {
    art: [
      "................", "..o..........o..", "..oo........oo..", "..ooo......ooo..",
      "..oooooooooooo..", ".oooooooooooooo.", ".ooookoooookooo.", ".oooooooooooooo.",
      ".wwooooooooooww.", "..wwwwwkkwwwww..", "...wwwwwwwwww...", "....wwwwwwww....",
      ".....wwwwww.....", "................", "................", "................",
    ],
    bg: "#dbeafe", id: "avatar-01", label: "Zorro", palette: { o: "#f97316", w: "#fff7ed" },
  },
  {
    art: [
      "................", "..g..........g..", "..gg........gg..", "..gpg......gpg..",
      "..gggggggggggg..", ".gggggggggggggg.", ".ggyyggggggyygg.", ".ggykggggggkygg.",
      ".gggggggggggggg.", ".ggggggppgggggg.", ".gggggkggkggggg.", "..gggggkkggggg..",
      "...gggggggggg...", "....gggggggg....", "................", "................",
    ],
    bg: "#fde68a", id: "avatar-02", label: "Gato", palette: { g: "#9ca3af", p: "#f9a8d4", y: "#facc15" },
  },
  {
    art: [
      "................", "................", "...www....www...", "..wwkww..wwkww..",
      "..wwwwwggwwwww..", ".gggggggggggggg.", ".gggggggggggggg.", ".gkggggggggggkg.",
      ".ggkkkkkkkkkkgg.", ".ggggrrrrrrgggg.", "..gggggggggggg..", "..dddggggggddd..",
      ".ddd........ddd.", "................", "................", "................",
    ],
    bg: "#bae6fd", id: "avatar-03", label: "Rana", palette: { d: "#15803d", g: "#22c55e", r: "#ef4444" },
  },
  {
    art: [
      "................", ".....nnnnnn.....", "....nnnnnnnn....", "...nnwwnnwwnn...",
      "...nwkwnnwkwn...", "...nnnwoownnn...", "..nnwwwwwwwwnn..", ".nnnwwwwwwwwnnn.",
      ".nnnwwwwwwwwnnn.", "..nnwwwwwwwwnn..", "..nnwwwwwwwwnn..", "...nnwwwwwwnn...",
      "....oo....oo....", "................", "................", "................",
    ],
    bg: "#a5f3fc", id: "avatar-04", label: "Pingüino", palette: { n: "#1f2937", o: "#f59e0b" },
  },
  {
    art: [
      "................", "..b..........b..", "..bb........bb..", "..bbbbbbbbbbbb..",
      ".bbwwwwbbwwwwbb.", ".bwwkkwbbwkkwwb.", ".bbwwwwoowwwwbb.", ".bbbbbboobbbbbb.",
      ".bbttttttttttbb.", ".bbttbttbttbtbb.", "..bttttttttttb..", "...bbttttttbb...",
      "....oo....oo....", "................", "................", "................",
    ],
    bg: "#c7d2fe", id: "avatar-05", label: "Búho", palette: { b: "#92400e", o: "#f97316", t: "#fcd34d" },
  },
  {
    art: [
      "................", "..nn........nn..", ".nnnn......nnnn.", ".nnwwwwwwwwwwnn.",
      "..wwwwwwwwwwww..", ".wwnnwwwwwwnnww.", ".wnnwnwwwwnwnnw.", ".wwnnwwwwwwnnww.",
      ".wwwwwwnnwwwwww.", ".wwwwwnwwnwwwww.", "..wwwwwnnwwwww..", "...wwwwwwwwww...",
      "....wwwwwwww....", "................", "................", "................",
    ],
    bg: "#bbf7d0", id: "avatar-06", label: "Panda", palette: { n: "#111827" },
  },
  {
    art: [
      "................", ".....pppppp.....", "....pppppppp....", "...pppppppppp...",
      "..pppppppppppp..", "..ppwwppppwwpp..", "..ppwkppppwkpp..", "..pppppppppppp..",
      "..pppppppppppp..", "..pppppppppppp..", ".pp.pp.pp.pp.pp.", "pp..p..pp..p..pp",
      "................", "................", "................", "................",
    ],
    bg: "#fef9c3", id: "avatar-07", label: "Pulpo", palette: { p: "#a855f7" },
  },
  {
    art: [
      "................", "...d........d...", "...dd......dd...", "...rrrrrrrrrr...",
      "..rrrrrrrrrrrr..", "..rryyrrrryyrr..", "..rrykrrrrkyrr..", ".rrrrrrrrrrrrrr.",
      ".rroooooooooorr.", ".rrokooooookorr.", "..rrwrwrwrwrrr..", "...rrrrrrrrrr...",
      "....dd....dd....", "................", "................", "................",
    ],
    bg: "#1e293b", id: "avatar-08", label: "Dragón", palette: { d: "#7f1d1d", o: "#fb923c", r: "#dc2626", y: "#facc15" },
  },
  {
    art: [
      "......g..g......", ".....gg.gg......", "......gggg......", ".....oooooo.....",
      ".....oodooo.....", ".....okooko.....", "......ooodo.....", "......ooooo.....",
      "......ooooo.....", ".......odoo.....", ".......ooo......", "........oo......",
      "........o.......", "................", "................", "................",
    ],
    bg: "#dcfce7", id: "avatar-09", label: "Zanahoria", palette: { d: "#c2410c", g: "#16a34a", o: "#f97316" },
  },
  {
    art: [
      "................", "......gggg......", ".....gllllg.....", "....gllllllg....",
      "....glkllklg....", "...gllllllllg...", "...glllbbbllg...", "..gllbbbbbbllg..",
      "..gllbbbbbbllg..", "..gllbbbbbbllg..", "..glllbbbblllg..", "...gllllllllg...",
      "....gggggggg....", "................", "................", "................",
    ],
    bg: "#fce7f3", id: "avatar-10", label: "Aguacate", palette: { b: "#92400e", g: "#3f6212", l: "#bef264" },
  },
  {
    art: [
      "................", ".......g........", ".....gggggg.....", "....rrrggrrr....",
      "...rrrrrrrrrr...", "..rrwrrrrrrrrr..", "..rwrrrrrrrrrr..", "..rrrkrrrrkrrr..",
      "..rrrrrrrrrrrr..", "..rrrrkkkkrrrr..", "...rrrrrrrrrr...", "....rrrrrrrr....",
      "................", "................", "................", "................",
    ],
    bg: "#e0f2fe", id: "avatar-11", label: "Tomate", palette: { g: "#16a34a", r: "#ef4444" },
  },
  {
    art: [
      "................", "....dd...dd.....", "...dggd.dggd....", "..dgggggggggd...",
      ".dgggggggggggd..", ".dgggdgggggdggd.", "..dgggggggggggd.", "...dddgggggddd..",
      "....ssssssss....", "....ssksskss....", "....ssssssss....", ".....ssssss.....",
      "......ssss......", "................", "................", "................",
    ],
    bg: "#ffedd5", id: "avatar-12", label: "Brócoli", palette: { d: "#14532d", g: "#16a34a", s: "#a3e635" },
  },
  {
    art: [
      "................", ".....rrrrrr.....", "...rrwwrrrrrr...", "..rrwwwrrrwwrr..",
      ".rrrrwrrrrwwrrr.", ".rwwrrrrrrrrrwr.", ".rrrrrrrrrrrrrr.", "...cccccccccc...",
      "....cckcckcc....", "....cccccccc....", "....cccccccc....", "....cccccccc....",
      ".....cccccc.....", "................", "................", "................",
    ],
    bg: "#d1fae5", id: "avatar-13", label: "Hongo", palette: { c: "#fef3c7", r: "#dc2626" },
  },
  {
    art: [
      "......g..g......", ".....gg.gg.g....", "......ggggg.....", ".......ggg......",
      ".....yyyyyy.....", "....yoyyoyyy....", "....ykyyyyky....", "....yyoyyoyy....",
      "....yyykkyyy....", "....yoyyoyyo....", "....yyyyyyyy....", ".....yoyyoy.....",
      "......yyyy......", "................", "................", "................",
    ],
    bg: "#ddd6fe", id: "avatar-14", label: "Piña", palette: { g: "#16a34a", o: "#d97706", y: "#facc15" },
  },
  {
    art: [
      "................", ".......r........", ".......d........", "...ssssssssss...",
      "..ssssssssssss..", "..ssddddddddss..", "..ssdccddccdss..", "..ssddddddddss..",
      "..ssssssssssss..", "..ssssddddssss..", "..ssssssssssss..", "...dddddddddd...",
      "..dd........dd..", "................", "................", "................",
    ],
    bg: "#fecaca", id: "avatar-15", label: "Robot", palette: { c: "#22d3ee", d: "#475569", r: "#ef4444", s: "#cbd5e1" },
  },
  {
    art: [
      "................", ".....wwwwww.....", "....wwwwwwww....", "...wwwwwwwwww...",
      "...wwkkwwkkww...", "...wwkkwwkkww...", "..wwbwwwwwwbww..", "..wwwwwkkwwwww..",
      "..wwwwwkkwwwww..", "..wwwwwwwwwwww..", "..wwwwwwwwwwww..", "..ww.www.www.w..",
      "..w...w...w.....", "................", "................", "................",
    ],
    bg: "#4c1d95", id: "avatar-16", label: "Fantasma", palette: { b: "#fda4af", w: "#f8fafc" },
  },
  {
    art: [
      ".......rr.......", "......rrrr......", ".....wwwwww.....", ".....wwwwww.....",
      ".....wwccww.....", ".....wccccw.....", ".....wwccww.....", ".....wwwwww.....",
      "....rwwwwwwr....", "...rrwwwwwwrr...", "...rr.wwww.rr...", "......oyyo......",
      ".......oo.......", ".......o........", "................", "................",
    ],
    bg: "#0f172a", id: "avatar-17", label: "Cohete", palette: { c: "#22d3ee", o: "#f97316", r: "#ef4444", y: "#fde047" },
  },
  {
    art: [
      "................", "......s..s......", ".....s..s.......", "......s..s......",
      "................", "...wwwwwwwwww...", "...wbbbbbbbbw...", "...wwwwwwwwwwww.",
      "...wwkwwwwkww.w.", "...wwwwkkwwww.w.", "...wwwwwwwwwwww.", "....wwwwwwww....",
      "..wwwwwwwwwwww..", "................", "................", "................",
    ],
    bg: "#fca5a5", id: "avatar-18", label: "Taza de café", palette: { b: "#78350f", s: "#e2e8f0", w: "#fafaf9" },
  },
  {
    art: [
      ".......f........", "......fff.......", ".....gggggg.....", ".....gkggkg.....",
      ".g...gggggg...g.", ".g...ggkkgg...g.", ".gggggggggggggg.", ".....gdgdgg.....",
      ".....gggggg.....", "....pppppppp....", "....pppppppp....", ".....pppppp.....",
      ".....pppppp.....", "................", "................", "................",
    ],
    bg: "#fef08a", id: "avatar-19", label: "Cactus", palette: { d: "#166534", f: "#f472b6", g: "#16a34a", p: "#c2410c" },
  },
  {
    art: [
      "................", "................", ".rrrrrrrrrrrrrr.", ".rrkrrrrrrrkrrr.",
      "..rrrrrkrrrrrr..", "..rrkrrrrrrkrr..", "...rrrrrrrrrr...", "...rrrkrrkrrr...",
      "....rrrrrrrr....", "....llllllll....", ".....gggggg.....", "......gggg......",
      "................", "................", "................", "................",
    ],
    bg: "#e0e7ff", id: "avatar-20", label: "Sandía", palette: { g: "#16a34a", l: "#86efac", r: "#f43f5e" },
  },
  {
    art: [
      "................", "...ww......ww...", "..wwww....wwww..", "..wwwww..wwwww..",
      "....yyyyyyyy....", "...yykyyyykyy...", "...yyyyyyyyyy...", "...nnnnnnnnnn...",
      "...yyyyyyyyyy...", "...nnnnnnnnnn...", "....yyyyyyyy....", ".....nnnnnn.....",
      ".......nn.......", "................", "................", "................",
    ],
    bg: "#bbf7d0", id: "avatar-21", label: "Abeja", palette: { n: "#1f2937", w: "#e0f2fe", y: "#facc15" },
  },
  {
    art: [
      "......c..c......", ".......cc.......", "........c.......", "....bbbbbbb.....",
      "..bbbbbbbbbbb...", ".bbbbbbbbbbbbb.b", ".bbkbbbbbbbbbbbb", ".bbbbbbbbbbbbbb.",
      ".bllllllllllbbb.", "..llllllllllbb..", "...bbbbbbbbbb...", "................",
      "................", "................", "................", "................",
    ],
    bg: "#cffafe", id: "avatar-22", label: "Ballena", palette: { b: "#3b82f6", c: "#0891b2", l: "#bfdbfe" },
  },
  {
    art: [
      "................", "................", "................", "..ssssssssssss..",
      ".ssssssssssssss.", ".ssdssssssssyss.", ".sdddssssssbsgs.", ".ssdssssssssrss.",
      ".ssssskksssssss.", ".ssss......ssss.", "..ss........ss..", "................",
      "................", "................", "................", "................",
    ],
    bg: "#fde68a", id: "avatar-23", label: "Control de juego", palette: { b: "#3b82f6", d: "#1e293b", g: "#22c55e", r: "#ef4444", s: "#94a3b8", y: "#facc15" },
  },
  {
    art: [
      "................", "......yyy.......", ".....yyyyy......", "....yyyyyyy.....",
      "....ykyyyky.....", "....yyyooyy.....", "...yyyyyyyyy....", "..yyyyyyyyyyy...",
      "..yyyyyyyyyyy...", "..yyyyyyyyyyy...", "...yyyyyyyyy....", ".....o...o......",
      "....oo..oo......", "................", "................", "................",
    ],
    bg: "#a7f3d0", id: "avatar-24", label: "Pollito", palette: { o: "#f97316", y: "#fde047" },
  },
];

export function renderAvatarPixels(spec) {
  if (spec.art.length !== SIZE || spec.art.some((row) => row.length !== SIZE)) {
    throw new Error(`${spec.id}: el dibujo debe ser de ${SIZE}×${SIZE}.`);
  }

  const palette = { ...BASE_PALETTE, ...spec.palette };
  const canvas = spec.art.map((row) =>
    [...row].map((symbol) => {
      if (symbol === ".") {
        return null;
      }

      if (!palette[symbol]) {
        throw new Error(`${spec.id}: color sin definir para «${symbol}».`);
      }

      return palette[symbol];
    }),
  );

  // A one-pixel outline around the silhouette gives the classic pixel-art read.
  return canvas.map((row, y) =>
    row.map((color, x) => {
      if (color) {
        return color;
      }

      const touchesFigure = [
        [y - 1, x],
        [y + 1, x],
        [y, x - 1],
        [y, x + 1],
      ].some(([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE && canvas[r][c]);

      return touchesFigure ? OUTLINE : null;
    }),
  );
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

      rects.push(`<rect x="${col}" y="${row}" width="${end - col + 1}" height="1" fill="${color}"/>`);
      col = end + 1;
    }
  }

  // Figures are drawn high in the grid; shift down to center them vertically.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -1 ${SIZE} ${SIZE}" width="128" height="128" shape-rendering="crispEdges">`,
    `<rect y="-1" width="${SIZE}" height="${SIZE + 1}" fill="${spec.bg}"/>`,
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
