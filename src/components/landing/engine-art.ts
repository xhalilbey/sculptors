import { seeded, type Point } from './journey-art';

/**
 * The drawings on the engine cards (engines.tsx), one object each, drawn in
 * light on the navy card -- the owner's bar for a card (a dark card, one
 * object, lines fading along their length, no blur). Each object is its
 * engine's myth, made to say what the engine does:
 *
 *   lightning  Zeus's bolt, branching: a memory growing from every event
 *   flame      Prometheus's fire: streams rising and meeting as they burn
 *   sphere     the world Atlas carries: every request, held up at once
 *
 * Pure arithmetic on a 400x280 canvas with a seeded random, so the server
 * and the browser draw the same picture.
 */

export const ENGINE_WIDTH = 400;
export const ENGINE_HEIGHT = 280;

const r1 = (n: number) => Math.round(n * 10) / 10;

export type Stroke = { readonly d: string; readonly level: number };

/**
 * Zeus: a bolt that forks at every step. Each segment is broken once at a
 * jittered midpoint, so it reads as lightning rather than as a tree.
 */
export function lightning(depth = 6, seed = 3) {
  const random = seeded(seed);
  const strokes: Stroke[] = [];
  const tips: Point[] = [];

  const grow = (from: Point, angle: number, length: number, level: number) => {
    const to = { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
    const kink = {
      x: (from.x + to.x) / 2 + (random() - 0.5) * length * 0.35,
      y: (from.y + to.y) / 2 + (random() - 0.5) * length * 0.2,
    };

    strokes.push({ d: `M${r1(from.x)} ${r1(from.y)} L${r1(kink.x)} ${r1(kink.y)} L${r1(to.x)} ${r1(to.y)}`, level });

    if (level === depth) {
      tips.push({ x: r1(to.x), y: r1(to.y) });

      return;
    }

    const spread = 0.32 + random() * 0.26;

    grow(to, angle - spread + (random() - 0.5) * 0.2, length * 0.72, level + 1);
    grow(to, angle + spread + (random() - 0.5) * 0.2, length * 0.72, level + 1);
  };

  const root = { x: ENGINE_WIDTH / 2, y: ENGINE_HEIGHT - 16 };

  grow(root, -Math.PI / 2, 66, 1);

  return { strokes, tips, root, depth };
}

/**
 * Prometheus: streams rising from the whole width of the card and meeting at
 * one point near the top, each with its own sway -- a flame made of data.
 */
export function flame(count = 26, seed = 5) {
  const random = seeded(seed);
  const top: Point = { x: ENGINE_WIDTH / 2, y: 36 };
  const streams: Array<{ d: string; t: number }> = [];

  for (let index = 0; index < count; index++) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const x0 = 24 + t * (ENGINE_WIDTH - 48);
    const sway = (random() - 0.5) * 70;
    const d =
      `M${r1(x0)} ${ENGINE_HEIGHT} ` +
      `C${r1(x0 + sway)} ${r1(ENGINE_HEIGHT - 90)} ` +
      `${r1(top.x + (x0 - top.x) * 0.3 - sway * 0.5)} ${r1(top.y + 90)} ` +
      `${top.x} ${top.y}`;

    streams.push({ d, t });
  }

  return { streams, top };
}

/**
 * Atlas: points spread evenly over a sphere (a Fibonacci lattice), tipped
 * towards the viewer, each sized and weighted by how near it is.
 */
export function sphere(count = 420, radius = 104, tilt = 0.42) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const center: Point = { x: ENGINE_WIDTH / 2, y: ENGINE_HEIGHT / 2 + 6 };
  const points: Array<{ x: number; y: number; r: number; o: number }> = [];

  for (let index = 0; index < count; index++) {
    const y = 1 - (index / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = index * golden;
    const x = Math.cos(phi) * ring;
    const z = Math.sin(phi) * ring;
    // Tip it about the horizontal axis, so the top shows.
    const yt = y * Math.cos(tilt) - z * Math.sin(tilt);
    const zt = y * Math.sin(tilt) + z * Math.cos(tilt);
    const near = (zt + 1) / 2;

    points.push({
      x: r1(center.x + x * radius),
      y: r1(center.y + yt * radius),
      r: r1(0.5 + 1.5 * near),
      o: r1(0.12 + 0.88 * near),
    });
  }

  return { points, center, radius };
}
