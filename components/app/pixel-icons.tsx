// 9×9 pixel icons drawn from ASCII grids; they inherit the text color.
const ICONS = {
  home: [
    "....#....",
    "...###...",
    "..#####..",
    ".#######.",
    "#########",
    ".#.....#.",
    ".#.##..#.",
    ".#.##..#.",
    ".#.##..#.",
  ],
  bolt: [
    ".....##..",
    "....##...",
    "...##....",
    "..#####..",
    ".....##..",
    "....##...",
    "...##....",
    "..##.....",
    ".#.......",
  ],
  flag: [
    "#........",
    "#######..",
    "#######..",
    "#######..",
    "#........",
    "#........",
    "#........",
    "#........",
    "#........",
  ],
  passport: [
    ".#######.",
    "#.......#",
    "#..###..#",
    "#..#.#..#",
    "#..###..#",
    "#.......#",
    "#.#####.#",
    "#.......#",
    ".#######.",
  ],
  points: [
    "..#####..",
    ".#.....#.",
    "#..###..#",
    "#..#....#",
    "#..###..#",
    "#....#..#",
    "#..###..#",
    ".#.....#.",
    "..#####..",
  ],
  qr: [
    "###.#.###",
    "#.#...#.#",
    "###.#.###",
    "....#....",
    "##.###.##",
    "....#.#..",
    "###..#.#.",
    "#.#.###..",
    "###.#..##",
  ],
  quiz: [
    "..#####..",
    ".##...##.",
    ".##...##.",
    ".....##..",
    "....##...",
    "...##....",
    "...##....",
    ".........",
    "...##....",
  ],
  trophy: [
    "#########",
    "#.#####.#",
    "#.#####.#",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
    "...###...",
    "..#####..",
  ],
} as const;

export type PixelIconName = keyof typeof ICONS;

export function PixelIcon({ className = "size-5", name }: { className?: string; name: PixelIconName }) {
  const rects: { width: number; x: number; y: number }[] = [];

  ICONS[name].forEach((row, y) => {
    let x = 0;

    while (x < row.length) {
      if (row[x] !== "#") {
        x += 1;
        continue;
      }

      const start = x;

      while (row[x] === "#") {
        x += 1;
      }

      rects.push({ width: x - start, x: start, y });
    }
  });

  return (
    <svg aria-hidden="true" className={className} fill="currentColor" shapeRendering="crispEdges" viewBox="0 0 9 9">
      {rects.map((rect) => (
        <rect height="1" key={`${rect.x}-${rect.y}`} width={rect.width} x={rect.x} y={rect.y} />
      ))}
    </svg>
  );
}
