/**
 * The geometry of the journey's three signature drawings (agent-journey.tsx),
 * after caretta.so's line art (owner's direction, 24 Sep 2026: "their
 * graphics explain the product"). Each one is a picture of a step in how
 * the agent sells, so together they read as one flow, left to right:
 *
 *   converge  a platform's data (catalog, customers, orders...) flowing into
 *             the Agent Store
 *   helix     two strands, shopper and agent, twisting through a conversation
 *   fanOut    one agent's work spreading into the events a platform receives
 *
 * Pure arithmetic on a 1200x400 canvas with a seeded random, so the server
 * and the browser draw the same picture and a reload does not reshuffle it.
 */

export const ART_WIDTH = 1200;
export const ART_HEIGHT = 400;

export type Point = { readonly x: number; readonly y: number };

export type ArtLine = {
  readonly d: string;
  /** Where the line's loose end is -- its source, or its destination. */
  readonly end: Point;
  /** 0..1, for staggering and for varying the dots. */
  readonly t: number;
};

export type ArtLabel = { readonly text: string; readonly at: Point };

/*
 * Labels stand in their own column beside the dots, never among them: set
 * at their own line's end they collided with the neighbouring lines' dots.
 * Sources sit right of LABEL_LEFT, destinations left of LABEL_RIGHT.
 */
const LABEL_LEFT = 176;
const LABEL_RIGHT = 912;

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

    lines.push({
      d: cubic(
        source,
        { x: source.x + 300, y: source.y },
        { x: agent.x - 280, y: agent.y + (source.y - agent.y) * 0.1 },
        agent
      ),
      end: source,
      t,
    });
  }

  const marks = labelled(lines, facts);
  const labels: ArtLabel[] = [...marks].map(([index, text]) => ({
    text,
    at: { x: LABEL_LEFT, y: lines[index]?.end.y ?? 0 },
  }));

  return { agent, lines, labels, exit: `M${agent.x} ${agent.y} L${ART_WIDTH - 20} ${agent.y}` };
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
  const rungs: Array<{ x: number; y1: number; y2: number; o: number }> = [];

  for (let x = 0, index = 0; x <= ART_WIDTH + period; x += step, index++) {
    const angle = (x / period) * Math.PI * 2;
    const sin = Math.sin(angle);
    const depthA = (Math.cos(angle) + 1) / 2;
    const depthB = 1 - depthA;

    dots.push({ x, y: r1(cy + amplitude * sin), r: r1(1.1 + 1.9 * depthA), o: r1(0.22 + 0.78 * depthA), strand: 'shopper' });
    dots.push({ x, y: r1(cy - amplitude * sin), r: r1(1.1 + 1.9 * depthB), o: r1(0.22 + 0.78 * depthB), strand: 'agent' });

    if (index % 3 === 0) {
      rungs.push({ x, y1: r1(cy + amplitude * sin), y2: r1(cy - amplitude * sin), o: r1(0.05 + 0.12 * Math.abs(sin)) });
    }
  }

  return { dots, rungs, period };
}

/**
 * After the sale: one order on the left, and from it a fan of curves to
 * everything the sale sets off, spread down the right.
 */
export function fanOut(outcomes: readonly string[], count = 40) {
  const random = seeded(11);
  const order: Point = { x: 330, y: ART_HEIGHT / 2 };
  const lines: ArtLine[] = [];

  for (let index = 0; index < count; index++) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const target: Point = {
      x: 820 + random() * 70,
      y: 26 + t * (ART_HEIGHT - 52) + (random() - 0.5) * 8,
    };

    lines.push({
      d: cubic(
        order,
        { x: order.x + 280, y: order.y + (target.y - order.y) * 0.1 },
        { x: target.x - 300, y: target.y },
        target
      ),
      end: target,
      t,
    });
  }

  const marks = labelled(lines, outcomes);
  const labels: ArtLabel[] = [...marks].map(([index, text]) => ({
    text,
    at: { x: LABEL_RIGHT, y: lines[index]?.end.y ?? 0 },
  }));

  return { order, lines, labels, entry: `M20 ${order.y} L${order.x} ${order.y}` };
}
