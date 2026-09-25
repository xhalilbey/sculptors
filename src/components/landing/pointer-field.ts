/**
 * The hover on the landing's drawings, after caretta.so's (owner's direction,
 * 25 Sep 2026: "I should feel them when I hover, like Caretta"). Read from
 * their renderer: the pointer is followed, not tracked -- its position eases
 * towards the real one every frame -- and it carries a power that each
 * pointermove raises by 0.05 (to at most 1) and each frame lets decay. So a
 * drawing answers a hand moving over it, and settles when the hand stops.
 * Whatever is within reach is pushed straight away from the pointer, by a
 * smoothstep of how near it is.
 *
 * Pure arithmetic, tested; use-pointer-field.ts drives it on a frame loop.
 */

/** Where the pointer is, in a drawing's own units, and how strongly it acts. */
export type Field = { readonly x: number; readonly y: number; readonly power: number };

/** How far the pointer reaches, and how far it pushes what is under it. */
export type Reach = { readonly radius: number; readonly push: number };

/** No pointer: everything at rest. */
export const STILL: Field = { x: 0, y: 0, power: 0 };

/** Caretta's numbers: the power one pointermove adds, and the easing base. */
const MOVE_GAIN = 0.05;
const EASE_BASE = 0.9;
const FRAME_MS = 1000 / 60;

/** The pointer's running state: the real position, the followed one, the power. */
export type Pointer = { tx: number; ty: number; x: number; y: number; power: number };

export function createPointer(): Pointer {
  return { tx: 0, ty: 0, x: 0, y: 0, power: 0 };
}

export function smoothstep(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;

  return clamped * clamped * (3 - 2 * clamped);
}

/** A pointermove, at (x, y) in the drawing's units. */
export function movePointer(pointer: Pointer, x: number, y: number): void {
  // A hand arriving from outside starts where it is, rather than sweeping
  // in from wherever it last left.
  if (pointer.power < 0.01) {
    pointer.x = x;
    pointer.y = y;
  }

  pointer.tx = x;
  pointer.ty = y;
  pointer.power = Math.min(1, pointer.power + MOVE_GAIN);
}

/** One frame of `dt` ms: the followed position eases in, the power decays. */
export function settlePointer(pointer: Pointer, dt: number): void {
  const s = 1 - Math.pow(EASE_BASE, dt / FRAME_MS);

  pointer.x += (pointer.tx - pointer.x) * s;
  pointer.y += (pointer.ty - pointer.y) * s;
  pointer.power *= 1 - 0.25 * s;
}

/**
 * Where the point (x, y) lands under the field. `freedom` is 0 where the
 * point is pinned (a line's root, a node) and 1 where it is loose. Points
 * are pushed away from the pointer, never across it: with `push` at most
 * half of `radius`, nearer points always stay nearer, so lines part around
 * the pointer and never fold.
 */
export function pushed(x: number, y: number, freedom: number, field: Field, reach: Reach): [number, number] {
  if (field.power <= 0 || freedom <= 0) {
    return [x, y];
  }

  const dx = x - field.x;
  const dy = y - field.y;
  const distance = Math.hypot(dx, dy);

  if (distance >= reach.radius || distance < 1e-6) {
    return [x, y];
  }

  const amount = smoothstep(1 - distance / reach.radius) * field.power * reach.push * freedom;

  return [x + (dx / distance) * amount, y + (dy / distance) * amount];
}

/* ---- lines as samples ---------------------------------------------------- */

/**
 * A line the field can bend: points along it, and how loose each one is.
 * `box` bounds the points, so a frame can skip a line out of reach.
 */
export type Strand = {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly free: readonly number[];
  readonly box: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
};

type Point = { readonly x: number; readonly y: number };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A strand through `points`; `freedom` gets each point's place along it (0..1) and the point. */
export function strand(points: readonly Point[], freedom: (t: number, point: Point) => number): Strand {
  const last = Math.max(1, points.length - 1);

  return {
    xs: points.map(p => p.x),
    ys: points.map(p => p.y),
    free: points.map((point, index) => freedom(index / last, point)),
    box: {
      x0: Math.min(...points.map(p => p.x)),
      y0: Math.min(...points.map(p => p.y)),
      x1: Math.max(...points.map(p => p.x)),
      y1: Math.max(...points.map(p => p.y)),
    },
  };
}

/** Whether any of the strand could be within the pointer's reach. */
export function inReach(line: Strand, field: Field, reach: Reach): boolean {
  if (field.power <= 0) {
    return false;
  }

  const { x0, y0, x1, y1 } = line.box;

  return (
    field.x > x0 - reach.radius && field.x < x1 + reach.radius && field.y > y0 - reach.radius && field.y < y1 + reach.radius
  );
}

/** Points along a cubic Bezier, evenly in t. */
export function sampleCubic(from: Point, c1: Point, c2: Point, to: Point, count: number): Point[] {
  const points: Point[] = [];

  for (let index = 0; index < count; index++) {
    const t = count === 1 ? 0 : index / (count - 1);
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;

    points.push({
      x: a * from.x + b * c1.x + c * c2.x + d * to.x,
      y: a * from.y + b * c1.y + c * c2.y + d * to.y,
    });
  }

  return points;
}

/**
 * A smooth path through points (Catmull-Rom, as cubic Beziers): straight
 * runs stay straight, and a bent line bends without corners.
 */
export function smoothPath(xs: readonly number[], ys: readonly number[]): string {
  const count = xs.length;

  if (count === 0) {
    return '';
  }

  let d = `M${r1(xs[0] ?? 0)} ${r1(ys[0] ?? 0)}`;

  for (let index = 0; index < count - 1; index++) {
    const x0 = xs[Math.max(0, index - 1)] ?? 0;
    const y0 = ys[Math.max(0, index - 1)] ?? 0;
    const x1 = xs[index] ?? 0;
    const y1 = ys[index] ?? 0;
    const x2 = xs[index + 1] ?? 0;
    const y2 = ys[index + 1] ?? 0;
    const x3 = xs[Math.min(count - 1, index + 2)] ?? 0;
    const y3 = ys[Math.min(count - 1, index + 2)] ?? 0;

    d +=
      ` C${r1(x1 + (x2 - x0) / 6)} ${r1(y1 + (y2 - y0) / 6)}` +
      ` ${r1(x2 - (x3 - x1) / 6)} ${r1(y2 - (y3 - y1) / 6)}` +
      ` ${r1(x2)} ${r1(y2)}`;
  }

  return d;
}

/** The strand under the field, as a path. */
export function bentPath(line: Strand, field: Field, reach: Reach): string {
  const xs: number[] = [];
  const ys: number[] = [];

  for (let index = 0; index < line.xs.length; index++) {
    const [x, y] = pushed(line.xs[index] ?? 0, line.ys[index] ?? 0, line.free[index] ?? 0, field, reach);

    xs.push(x);
    ys.push(y);
  }

  return smoothPath(xs, ys);
}

/** The strand under the field, as straight segments (for a bolt's kinks). */
export function bentPolyline(line: Strand, field: Field, reach: Reach): string {
  let d = '';

  for (let index = 0; index < line.xs.length; index++) {
    const [x, y] = pushed(line.xs[index] ?? 0, line.ys[index] ?? 0, line.free[index] ?? 0, field, reach);

    d += `${index === 0 ? 'M' : ' L'}${r1(x)} ${r1(y)}`;
  }

  return d;
}
