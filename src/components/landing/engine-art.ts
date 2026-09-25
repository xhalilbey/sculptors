import { seeded, type Point } from './journey-art';
import { sampleCubic, smoothstep, strand, type Strand } from './pointer-field';

/**
 * The drawings on the engine cards (engines.tsx), one object each, drawn in
 * light on the navy card -- the owner's bar for a card (a dark card, one
 * object, lines fading along their length, no blur, and no glow behind it:
 * "they should not shine", 25 Sep 2026). Each object is its engine's myth,
 * made to say what the engine does:
 *
 *   lightning  Zeus's bolt, branching: a memory growing from every event,
 *              with the events running up it to the memories they update
 *   flame      Prometheus's fire: streams rising and meeting as they burn
 *   armillary  the celestial sphere Atlas carries, as the instrument of
 *              rings it was drawn as: requests travel the rings, and more of
 *              them join as the load rises
 *
 * Pure arithmetic on a 400x280 canvas with a seeded random, so the server
 * and the browser draw the same picture. Lines come with strands
 * (pointer-field.ts) for the hover to bend.
 */

export const ENGINE_WIDTH = 400;
export const ENGINE_HEIGHT = 280;

const r1 = (n: number) => Math.round(n * 10) / 10;

export type Stroke = { readonly d: string; readonly level: number; readonly strand: Strand };

/**
 * Zeus: a bolt that forks at every step. Each segment is broken once at a
 * jittered midpoint, so it reads as lightning rather than as a tree.
 * `branches` are the root-to-tip routes, for the events that run up it.
 */
export function lightning(depth = 6, seed = 3) {
  const random = seeded(seed);
  const root: Point = { x: ENGINE_WIDTH / 2, y: ENGINE_HEIGHT - 16 };
  const strokes: Stroke[] = [];
  const tips: Point[] = [];
  const branches: Point[][] = [];
  // Pinned at the root, looser the further up the bolt a point is.
  const freedom = (_: number, point: Point) => smoothstep(Math.hypot(point.x - root.x, point.y - root.y) / 180);

  const grow = (from: Point, angle: number, length: number, level: number, trail: readonly Point[]) => {
    const to = { x: r1(from.x + Math.cos(angle) * length), y: r1(from.y + Math.sin(angle) * length) };
    const kink = {
      x: r1((from.x + to.x) / 2 + (random() - 0.5) * length * 0.35),
      y: r1((from.y + to.y) / 2 + (random() - 0.5) * length * 0.2),
    };
    const route = [...trail, kink, to];

    strokes.push({
      d: `M${from.x} ${from.y} L${kink.x} ${kink.y} L${to.x} ${to.y}`,
      level,
      strand: strand([from, kink, to], freedom),
    });

    if (level === depth) {
      tips.push(to);
      branches.push(route);

      return;
    }

    const spread = 0.32 + random() * 0.26;

    grow(to, angle - spread + (random() - 0.5) * 0.2, length * 0.72, level + 1, route);
    grow(to, angle + spread + (random() - 0.5) * 0.2, length * 0.72, level + 1, route);
  };

  grow(root, -Math.PI / 2, 66, 1, [root]);

  return {
    strokes,
    tips,
    root,
    depth,
    branches: branches.map(points => ({ points, strand: strand(points, freedom) })),
  };
}

/**
 * Prometheus: streams rising from the whole width of the card and meeting at
 * one point near the top, each with its own sway -- a flame made of data.
 */
export function flame(count = 26, seed = 5) {
  const random = seeded(seed);
  const top: Point = { x: ENGINE_WIDTH / 2, y: 36 };
  const streams: Array<{ d: string; t: number; strand: Strand }> = [];

  for (let index = 0; index < count; index++) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const from: Point = { x: r1(24 + t * (ENGINE_WIDTH - 48)), y: ENGINE_HEIGHT };
    const sway = (random() - 0.5) * 70;
    const c1: Point = { x: r1(from.x + sway), y: r1(ENGINE_HEIGHT - 90) };
    const c2: Point = { x: r1(top.x + (from.x - top.x) * 0.3 - sway * 0.5), y: r1(top.y + 90) };

    streams.push({
      d: `M${from.x} ${from.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${top.x} ${top.y}`,
      t,
      // Held at the card's edge and at the fire's point; loose between.
      strand: strand(sampleCubic(from, c1, c2, top, 18), at => smoothstep(Math.min(1, at / 0.3, (1 - at) / 0.3))),
    });
  }

  return { streams, top };
}

/* ---- Atlas: the armillary sphere ---------------------------------------- */

type Vec3 = readonly [number, number, number];

/**
 * One ring of the instrument. Its plane is given by its normal, in the
 * sphere's own frame (the polar axis is +y); a small circle (an edge of the
 * zodiac band) sits `offset` off the centre along that normal.
 */
export type Ring = {
  readonly normal: Vec3;
  readonly offset: number;
  readonly radius: number;
  /** Requests always travelling this ring, and the most it takes under load. */
  readonly base: number;
  readonly slots: number;
  /** How fast its requests travel, in radians a second (sign = direction). */
  readonly speed: number;
};

/** How the sphere is turned: about its axis, then tipped towards us and leaned. */
export type Pose = { readonly spin: number; readonly tilt: number; readonly lean: number };

const OBLIQUITY = (23.44 * Math.PI) / 180;
const BAND = (6 * Math.PI) / 180;

export const ARMILLARY = {
  center: { x: ENGINE_WIDTH / 2, y: 140 },
  radius: 98,
  /** The polar axis runs this far past the sphere, in radii. */
  axis: 1.22,
  rest: { spin: 0.6, tilt: 0.3, lean: -0.22 } satisfies Pose,
};

const ECLIPTIC: Vec3 = [0, Math.cos(OBLIQUITY), Math.sin(OBLIQUITY)];

/*
 * The equator, the two colures through the poles, and the zodiac band (the
 * ecliptic, drawn as its two edges). The first pass also had the tropics:
 * seven rings read as a tangle at card size.
 */
export const RINGS: readonly Ring[] = [
  { normal: [0, 1, 0], offset: 0, radius: 1, base: 2, slots: 6, speed: 0.5 },
  { normal: [1, 0, 0], offset: 0, radius: 1, base: 1, slots: 4, speed: 0.28 },
  { normal: [0, 0, 1], offset: 0, radius: 1, base: 1, slots: 4, speed: -0.24 },
  { normal: ECLIPTIC, offset: Math.sin(BAND), radius: Math.cos(BAND), base: 2, slots: 6, speed: 0.62 },
  { normal: ECLIPTIC, offset: -Math.sin(BAND), radius: Math.cos(BAND), base: 2, slots: 6, speed: 0.62 },
];

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;

  return [v[0] / length, v[1] / length, v[2] / length];
}

/** Two unit vectors spanning the ring's plane. */
function basis(normal: Vec3): [Vec3, Vec3] {
  const pick: Vec3 = Math.abs(normal[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(cross(pick, normal));

  return [u, cross(normal, u)];
}

/** From the sphere's frame to the viewer's: spin about the axis, tilt about x, lean about z. */
export function orient(v: Vec3, pose: Pose): Vec3 {
  const [x0, y0, z0] = v;
  const x1 = x0 * Math.cos(pose.spin) + z0 * Math.sin(pose.spin);
  const z1 = -x0 * Math.sin(pose.spin) + z0 * Math.cos(pose.spin);
  const y2 = y0 * Math.cos(pose.tilt) - z1 * Math.sin(pose.tilt);
  const z2 = y0 * Math.sin(pose.tilt) + z1 * Math.cos(pose.tilt);

  return [x1 * Math.cos(pose.lean) - y2 * Math.sin(pose.lean), x1 * Math.sin(pose.lean) + y2 * Math.cos(pose.lean), z2];
}

function toScreen(v: Vec3): Point {
  return { x: ARMILLARY.center.x + ARMILLARY.radius * v[0], y: ARMILLARY.center.y - ARMILLARY.radius * v[1] };
}

/** Radical inverse in base 2: 0, 1/2, 1/4, 3/4... so any first few slots spread out. */
function spread(index: number): number {
  let value = 0;
  let unit = 0.5;

  for (let rest = index; rest > 0; rest >>= 1, unit /= 2) {
    value += (rest & 1) * unit;
  }

  return value;
}

export type RingFrame = {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  /** The ellipse's rotation, in degrees. */
  readonly angle: number;
  /** The depth fade runs from the near side (y1) to the far side (y2), in the ellipse's own frame. */
  readonly y1: number;
  readonly y2: number;
};

export type RequestFrame = { readonly x: number; readonly y: number; readonly r: number; readonly o: number };

/**
 * One frame of the instrument at `pose`, `time` seconds in, under `load`
 * (0..1): each ring as a rotated ellipse -- a circle seen from anywhere is
 * one -- with the line to fade it by depth, and every request's dot.
 * Rounded, so the server's first frame and the browser's are the same.
 */
export function armillary(pose: Pose, time: number, load: number) {
  const { radius } = ARMILLARY;
  const rings: RingFrame[] = [];
  const requests: RequestFrame[] = [];

  for (const ring of RINGS) {
    const normal = orient(ring.normal, pose);
    const center = toScreen(orient([ring.normal[0] * ring.offset, ring.normal[1] * ring.offset, ring.normal[2] * ring.offset], pose));
    const flat = Math.hypot(normal[0], normal[1]);
    const rx = radius * ring.radius;
    const ry = Math.max(0.5, rx * Math.abs(normal[2]));
    // The major axis lies across the normal's shadow on the screen; the
    // nearest point sits on the minor axis, on the side the normal faces.
    const angle = flat < 1e-6 ? 0 : (Math.atan2(-normal[0], -normal[1]) * 180) / Math.PI;
    const near = normal[2] >= 0 ? -1 : 1;

    rings.push({
      cx: r1(center.x),
      cy: r1(center.y),
      rx: r1(rx),
      ry: r1(ry),
      angle: r1(angle),
      y1: r1(center.y + near * ry),
      y2: r1(center.y - near * ry),
    });

    const [u, v] = basis(ring.normal);
    const extra = load * (ring.slots - ring.base);

    for (let slot = 0; slot < ring.slots; slot++) {
      const shown = slot < ring.base ? 1 : Math.min(1, Math.max(0, extra - (slot - ring.base)));

      if (shown <= 0) {
        requests.push({ x: 0, y: 0, r: 0, o: 0 });
        continue;
      }

      const phi = spread(slot) * Math.PI * 2 + ring.speed * time;
      const local: Vec3 = [
        ring.normal[0] * ring.offset + ring.radius * (u[0] * Math.cos(phi) + v[0] * Math.sin(phi)),
        ring.normal[1] * ring.offset + ring.radius * (u[1] * Math.cos(phi) + v[1] * Math.sin(phi)),
        ring.normal[2] * ring.offset + ring.radius * (u[2] * Math.cos(phi) + v[2] * Math.sin(phi)),
      ];
      const seen = orient(local, pose);
      const at = toScreen(seen);
      const nearness = (seen[2] + 1) / 2;

      requests.push({
        x: r1(at.x),
        y: r1(at.y),
        r: r1((1.1 + 1.6 * nearness) * (0.4 + 0.6 * shown)),
        o: Math.round((0.25 + 0.75 * nearness) * shown * 100) / 100,
      });
    }
  }

  const north = toScreen(orient([0, ARMILLARY.axis, 0], pose));
  const south = toScreen(orient([0, -ARMILLARY.axis, 0], pose));

  return {
    rings,
    requests,
    axis: { x1: r1(north.x), y1: r1(north.y), x2: r1(south.x), y2: r1(south.y) },
  };
}
