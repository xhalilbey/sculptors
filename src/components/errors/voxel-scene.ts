/**
 * Block numerals for the error pages, built from cubes and drawn in
 * a parallel projection -- the "sculpted" 404 the owner asked for after
 * Cursor's, generated here rather than borrowed.
 *
 * Each glyph is a bitmap; every filled cell is a column extruded DEPTH cells
 * back. The camera looks from the front, above and left, so a block shows
 * three faces: its front, its top and its left side. Faces are ordered back
 * to front (painter's algorithm) and each carries only the edges that
 * outline its flat region, so neighbouring cubes read as one solid numeral
 * instead of a grid of boxes.
 *
 * Pure: no framework, no DOM. voxel-art.tsx turns a scene into SVG.
 */

export type Point = readonly [number, number];

export type FaceKind = 'front' | 'top' | 'side';

export interface Face {
  kind: FaceKind;
  points: readonly Point[];
  /** The edges to stroke: the outline of the flat region this face is part of. */
  edges: ReadonlyArray<readonly [Point, Point]>;
}

export interface VoxelScene {
  faces: Face[];
  viewBox: { x: number; y: number; width: number; height: number };
}

/** Bold 6 x 8 numerals: two-cell strokes, corners knocked off. */
const GLYPHS: Record<string, readonly string[]> = {
  '0': ['.XXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXX.'],
  '4': ['...XX.', '..XXX.', '.XXXX.', 'XX.XX.', 'XXXXXX', 'XXXXXX', '...XX.', '...XX.'],
  '5': ['XXXXXX', 'XXXXXX', 'XX....', 'XXXXX.', 'XXXXXX', '....XX', 'XXXXXX', 'XXXXX.'],
};

const GLYPH_HEIGHT = 8;
const GLYPH_WIDTH = 6;
/** Empty columns between numerals. */
const GAP = 1;
/** How far each numeral is extruded, in cells. */
const DEPTH = 2;
const PADDING = 1.5;

/**
 * World axes: x along the text, y up, z toward the viewer. On screen the
 * text rises 20 degrees to the right and the extrusion runs short and down
 * to the right, so the numerals' fronts stay large enough to read -- a true
 * isometric view gave the tops and sides the same weight as the fronts and
 * "404" stopped reading as a number.
 */
const X_AXIS: Point = [0.94, -0.34];
const Z_AXIS: Point = [0.5, 0.29];

function project(x: number, y: number, z: number): Point {
  return [x * X_AXIS[0] + z * Z_AXIS[0], x * X_AXIS[1] - y + z * Z_AXIS[1]];
}

/**
 * How near a block is to the camera. The projection flattens the direction
 * (-1, 0.885, 1.88) to a point, so that is where the camera sits: blocks
 * with a larger -x + 0.885y are nearer and are painted later.
 */
function nearness(x: number, y: number): number {
  return -x + 0.885 * y;
}

/** The filled cells of a string, as "x,y" keys, y counted up from the baseline. */
export function cellsOf(text: string): Set<string> {
  const cells = new Set<string>();

  [...text].forEach((character, index) => {
    const glyph = GLYPHS[character];

    if (!glyph) throw new RangeError(`No block glyph for "${character}"`);

    const left = index * (GLYPH_WIDTH + GAP);

    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, column) => {
        if (pixel === 'X') cells.add(`${left + column},${GLYPH_HEIGHT - 1 - rowIndex}`);
      });
    });
  });

  return cells;
}

/** The faces of a set of cells, back to front, with the viewBox that frames them. */
export function sceneOf(cells: ReadonlySet<string>): VoxelScene {
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  const topShows = (x: number, y: number) => has(x, y) && !has(x, y + 1);
  const sideShows = (x: number, y: number) => has(x, y) && !has(x - 1, y);
  const blocks = [...cells]
    .map((key) => key.split(',').map(Number) as [number, number])
    // Farthest first.
    .sort(([ax, ay], [bx, by]) => nearness(ax, ay) - nearness(bx, by));
  const faces: Face[] = [];
  const D = DEPTH;

  for (const [x, y] of blocks) {
    const p = project;

    if (!has(x - 1, y)) {
      const [back0, front0, front1, back1] = [p(x, y, 0), p(x, y, D), p(x, y + 1, D), p(x, y + 1, 0)];
      const edges: Array<readonly [Point, Point]> = [
        [front0, front1],
        [back0, back1],
      ];

      if (!sideShows(x, y - 1)) edges.push([back0, front0]);
      if (!sideShows(x, y + 1)) edges.push([back1, front1]);
      faces.push({ kind: 'side', points: [back0, front0, front1, back1], edges });
    }

    if (!has(x, y + 1)) {
      const [backLeft, backRight, frontRight, frontLeft] = [
        p(x, y + 1, 0),
        p(x + 1, y + 1, 0),
        p(x + 1, y + 1, D),
        p(x, y + 1, D),
      ];
      const edges: Array<readonly [Point, Point]> = [
        [frontLeft, frontRight],
        [backLeft, backRight],
      ];

      if (!topShows(x - 1, y)) edges.push([backLeft, frontLeft]);
      if (!topShows(x + 1, y)) edges.push([backRight, frontRight]);
      faces.push({ kind: 'top', points: [backLeft, backRight, frontRight, frontLeft], edges });
    }

    const [bottomLeft, bottomRight, topRight, topLeft] = [p(x, y, D), p(x + 1, y, D), p(x + 1, y + 1, D), p(x, y + 1, D)];
    const edges: Array<readonly [Point, Point]> = [];

    if (!has(x, y - 1)) edges.push([bottomLeft, bottomRight]);
    if (!has(x + 1, y)) edges.push([bottomRight, topRight]);
    if (!has(x, y + 1)) edges.push([topLeft, topRight]);
    if (!has(x - 1, y)) edges.push([bottomLeft, topLeft]);
    faces.push({ kind: 'front', points: [bottomLeft, bottomRight, topRight, topLeft], edges });
  }

  const xs = faces.flatMap((face) => face.points.map(([px]) => px));
  const ys = faces.flatMap((face) => face.points.map(([, py]) => py));
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;

  return {
    faces,
    viewBox: {
      x: minX,
      y: minY,
      width: Math.max(...xs) + PADDING - minX,
      height: Math.max(...ys) + PADDING - minY,
    },
  };
}
