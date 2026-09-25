/**
 * The geometry of the journey's three signature drawings (agent-journey.tsx),
 * after caretta.so's line art (owner's direction, 24 Sep 2026: "their
 * graphics explain the product"). Each one is a picture of a step in how
 * the agent sells, so together they read as one flow, left to right:
 *
 *   converge  a platform's data (catalog, customers, orders...) flowing into
 *             the Agent Store
 *   helix     two strands, shopper and agent, twisting through a conversation
 *   rails     the agent's events running back to the platform, one rail
 *             each, like lines on a transit map
 *
 * Pure arithmetic on a 1200x400 canvas with a seeded random, so the server
 * and the browser draw the same picture and a reload does not reshuffle it.
 * Each line also comes as a strand (pointer-field.ts): points along it, and
 * how loose each is, for the hover to bend.
 */

import { sampleCubic, smoothstep, strand, type Strand } from './pointer-field';

export const ART_WIDTH = 1200;
export const ART_HEIGHT = 400;

export type Point = { readonly x: number; readonly y: number };

export type ArtLine = {
  readonly d: string;
  /** Where the line's loose end is -- its source, or its destination. */
  readonly end: Point;
  /** 0..1, for staggering and for varying the dots. */
  readonly t: number;
  readonly strand: Strand;
};

export type ArtLabel = { readonly text: string; readonly at: Point };

/*
 * Labels stand in their own column beside the dots, never among them: set
 * at their own line's end they collided with the neighbouring lines' dots.
 * Sources sit right of LABEL_LEFT.
 */
const LABEL_LEFT = 176;

/** A line's samples for the hover: enough that a bent line stays smooth. */
const SAMPLES = 22;

/** A small deterministic generator (Park-Miller), 0 <= value < 1. */
export function seeded(seed: number): () => number {
  let state = seed % 2147483647;

  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;

    return (state - 1) / 2147483646;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function cubic(from: Point, c1: Point, c2: Point, to: Point): string {
  return `M${r1(from.x)} ${r1(from.y)} C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(to.x)} ${r1(to.y)}`;
}

/** Labels go on evenly spaced lines, so they never crowd one another. */
function labelled<T>(items: readonly T[], texts: readonly string[]): Map<number, string> {
  const map = new Map<number, string>();

  texts.forEach((text, index) => {
    const at = Math.round(((index + 0.5) / texts.length) * items.length - 0.5);

    map.set(Math.min(items.length - 1, Math.max(0, at)), text);
  });

  return map;
}

/**
 * Before the message: facts scattered down the left, each on its own curve
 * into one point -- the agent -- and a single line leaving it to the right.
 */
export function converge(facts: readonly string[], count = 40) {
  const random = seeded(7);
  const agent: Point = { x: 760, y: ART_HEIGHT / 2 };
  const lines: ArtLine[] = [];

  for (let index = 0; index < count; index++) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const source: Point = {
      x: LABEL_LEFT + 20 + random() * 100,
      y: 26 + t * (ART_HEIGHT - 52) + (random() - 0.5) * 8,
    };

    const c1 = { x: source.x + 300, y: source.y };
    const c2 = { x: agent.x - 280, y: agent.y + (source.y - agent.y) * 0.1 };

    lines.push({
      d: cubic(source, c1, c2, agent),
      end: source,
      t,
      // Loose at the source, pinned where it reaches the agent.
      strand: strand(sampleCubic(source, c1, c2, agent, SAMPLES), at => smoothstep(Math.min(1, (1 - at) / 0.75))),
    });
  }

  const marks = labelled(lines, facts);
  const labels: ArtLabel[] = [...marks].map(([index, text]) => ({
    text,
    at: { x: LABEL_LEFT, y: lines[index]?.end.y ?? 0 },
  }));
  const exitEnd: Point = { x: ART_WIDTH - 20, y: agent.y };

  return {
    agent,
    lines,
    labels,
    exit: {
      d: `M${agent.x} ${agent.y} L${exitEnd.x} ${exitEnd.y}`,
      strand: strand(straight(agent, exitEnd, SAMPLES), at => smoothstep(Math.min(1, at / 0.6))),
    },
  };
}

/** Evenly spaced points on a straight line, both ends included. */
function straight(from: Point, to: Point, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);

    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

/**
 * In the conversation: a double helix, shopper and agent, drawn as dots
 * whose size and weight follow their depth, with rungs where they face each
 * other. It is periodic in `period`, so sliding it by one period loops it
 * without a seam; it is drawn one period wider than the canvas for that.
 */
export function helix(period = 300, step = 7, amplitude = 74) {
  const cy = ART_HEIGHT / 2;
  const dots: Array<{ x: number; y: number; r: number; o: number; strand: 'shopper' | 'agent' }> = [];
  /** A rung joins the two dots at its x: `a` (shopper) and `b` (agent), by index. */
  const rungs: Array<{ x: number; y1: number; y2: number; o: number; a: number; b: number }> = [];

  for (let x = 0, index = 0; x <= ART_WIDTH + period; x += step, index++) {
    const angle = (x / period) * Math.PI * 2;
    const sin = Math.sin(angle);
    const depthA = (Math.cos(angle) + 1) / 2;
    const depthB = 1 - depthA;

    dots.push({ x, y: r1(cy + amplitude * sin), r: r1(1.1 + 1.9 * depthA), o: r1(0.22 + 0.78 * depthA), strand: 'shopper' });
    dots.push({ x, y: r1(cy - amplitude * sin), r: r1(1.1 + 1.9 * depthB), o: r1(0.22 + 0.78 * depthB), strand: 'agent' });

    if (index % 3 === 0) {
      rungs.push({
        x,
        y1: r1(cy + amplitude * sin),
        y2: r1(cy - amplitude * sin),
        o: r1(0.05 + 0.12 * Math.abs(sin)),
        a: dots.length - 2,
        b: dots.length - 1,
      });
    }
  }

  return { dots, rungs, period };
}

/** A rail's parts: its rest path, its strand, and where it meets the platform. */
export type Rail = {
  readonly d: string;
  readonly strand: Strand;
  readonly port: Point;
  readonly label: ArtLabel;
  /** 0..1, top rail to bottom. */
  readonly t: number;
};

/**
 * Back to the platform: the agent's events leave it as one bundle of
 * parallel rails, peel off at 45 degrees -- the outer ones first, so no two
 * ever cross -- and run level into the platform, one port each. A transit
 * map's grammar: it reads as routes, where the first chapter's curves read
 * as flow.
 */
export function rails(events: readonly string[]) {
  const agent: Point = { x: 250, y: ART_HEIGHT / 2 };
  const platform = { x: 890, top: 30, bottom: ART_HEIGHT - 30 };
  const mid = (events.length - 1) / 2;
  // Lanes spread to fill the canvas, up to 64 apart (five fill it; seven sit 50 apart).
  const lane = Math.min(64, (ART_HEIGHT - 100) / Math.max(1, events.length - 1));
  const BUNDLE = 6;
  const SPLIT = 340;
  const STAGGER = 16;

  const routes: Rail[] = events.map((text, index) => {
    const offset = index - mid;
    const bundleY = agent.y + offset * BUNDLE;
    const laneY = agent.y + offset * lane;
    const splitX = SPLIT + (mid - Math.abs(offset)) * STAGGER;
    const { d, points } = route(
      [
        agent,
        { x: agent.x + 36, y: bundleY },
        { x: splitX, y: bundleY },
        { x: splitX + Math.abs(laneY - bundleY), y: laneY },
        { x: platform.x, y: laneY },
      ],
      14,
      18
    );
    const length = pathLength(points);
    const ramp = Math.min(0.5, 70 / length);

    return {
      d,
      // Pinned at both ends, the agent and the port: a string between them.
      strand: strand(points, at => smoothstep(Math.min(1, at / ramp, (1 - at) / ramp))),
      port: { x: platform.x, y: laneY },
      label: { text, at: { x: platform.x + 22, y: laneY } },
      t: events.length === 1 ? 0.5 : index / (events.length - 1),
    };
  });

  const entryStart: Point = { x: 20, y: agent.y };

  return {
    agent,
    platform,
    rails: routes,
    entry: {
      d: `M${entryStart.x} ${entryStart.y} L${agent.x} ${agent.y}`,
      strand: strand(straight(entryStart, agent, SAMPLES), at => smoothstep(Math.min(1, (1 - at) / 0.6))),
    },
  };
}

function pathLength(points: readonly Point[]): number {
  let length = 0;

  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];

    if (a && b) {
      length += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }

  return length;
}

/**
 * A polyline with its corners rounded (a quadratic through each corner),
 * as a path and as points every `step` along it for the hover.
 */
function route(corners: readonly Point[], radius: number, step: number): { d: string; points: Point[] } {
  const stops = corners.filter((point, index) => {
    const before = corners[index - 1];

    return !before || Math.hypot(point.x - before.x, point.y - before.y) > 0.01;
  });
  const first = stops[0] ?? { x: 0, y: 0 };
  const points: Point[] = [first];
  let d = `M${r1(first.x)} ${r1(first.y)}`;
  let cursor = first;

  const run = (from: Point, to: Point) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const count = Math.max(1, Math.round(length / step));

    for (let index = 1; index <= count; index++) {
      points.push({ x: from.x + ((to.x - from.x) * index) / count, y: from.y + ((to.y - from.y) * index) / count });
    }
  };

  for (let index = 1; index < stops.length; index++) {
    const corner = stops[index] ?? cursor;
    const before = stops[index - 1] ?? cursor;
    const after = stops[index + 1];

    if (!after) {
      run(cursor, corner);
      d += ` L${r1(corner.x)} ${r1(corner.y)}`;
      break;
    }

    const inLength = Math.hypot(corner.x - before.x, corner.y - before.y);
    const outLength = Math.hypot(after.x - corner.x, after.y - corner.y);
    const cut = Math.min(radius, inLength / 2, outLength / 2);
    const entry = {
      x: corner.x - ((corner.x - before.x) / inLength) * cut,
      y: corner.y - ((corner.y - before.y) / inLength) * cut,
    };
    const exit = {
      x: corner.x + ((after.x - corner.x) / outLength) * cut,
      y: corner.y + ((after.y - corner.y) / outLength) * cut,
    };

    run(cursor, entry);
    d += ` L${r1(entry.x)} ${r1(entry.y)} Q${r1(corner.x)} ${r1(corner.y)} ${r1(exit.x)} ${r1(exit.y)}`;

    for (const t of [0.25, 0.5, 0.75, 1]) {
      const u = 1 - t;

      points.push({
        x: u * u * entry.x + 2 * u * t * corner.x + t * t * exit.x,
        y: u * u * entry.y + 2 * u * t * corner.y + t * t * exit.y,
      });
    }

    cursor = exit;
  }

  return { d, points };
}
