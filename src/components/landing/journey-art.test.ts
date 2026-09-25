import { describe, expect, it } from 'vitest';
import { ART_HEIGHT, ART_WIDTH, converge, helix, rails, seeded } from './journey-art';

describe('seeded', () => {
  it('repeats itself for the same seed, so server and browser draw alike', () => {
    const a = seeded(7);
    const b = seeded(7);

    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays in [0, 1)', () => {
    const next = seeded(42);

    for (let index = 0; index < 1000; index++) {
      const value = next();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('converge', () => {
  const facts = ['size 38', 'returned a 37', 'prefers black'];
  const art = converge(facts, 30);

  it('ends every line on the agent', () => {
    for (const line of art.lines) {
      expect(line.d.endsWith(`${art.agent.x} ${art.agent.y}`)).toBe(true);
    }
  });

  it('keeps its sources on the canvas and to the left of the agent', () => {
    for (const line of art.lines) {
      expect(line.end.x).toBeLessThan(art.agent.x);
      expect(line.end.y).toBeGreaterThan(0);
      expect(line.end.y).toBeLessThan(ART_HEIGHT);
    }
  });

  it('labels as many lines as it has facts, in a column left of every dot', () => {
    expect(art.labels.map(label => label.text)).toEqual(facts);

    const leftmostDot = Math.min(...art.lines.map(line => line.end.x));

    for (const label of art.labels) {
      expect(label.at.x).toBeGreaterThan(0);
      expect(label.at.x).toBeLessThan(leftmostDot);
    }
  });
});

describe('converge strands', () => {
  const art = converge(['a', 'b'], 12);

  it('run from the source to the agent, loose at the source and pinned at the agent', () => {
    for (const line of art.lines) {
      expect(line.strand.xs[0]).toBeCloseTo(line.end.x, 5);
      expect(line.strand.xs.at(-1)).toBeCloseTo(art.agent.x, 5);
      expect(line.strand.free[0]).toBe(1);
      expect(line.strand.free.at(-1)).toBe(0);
    }
  });
});

describe('rails', () => {
  const events = ['order.created', 'cart.recovered', 'handoff.requested', 'memory.updated', 'review.collected'];
  const art = rails(events);

  /** A rail's height at x, read off its samples (every rail runs left to right). */
  const heightAt = (xs: readonly number[], ys: readonly number[], x: number) => {
    for (let index = 1; index < xs.length; index++) {
      const x0 = xs[index - 1] ?? 0;
      const x1 = xs[index] ?? 0;

      if (x >= x0 && x <= x1 && x1 > x0) {
        return (ys[index - 1] ?? 0) + (((ys[index] ?? 0) - (ys[index - 1] ?? 0)) * (x - x0)) / (x1 - x0);
      }
    }

    return Number.NaN;
  };

  it('runs every rail from the agent to its port on the platform', () => {
    for (const rail of art.rails) {
      expect(rail.d.startsWith(`M${art.agent.x} ${art.agent.y}`)).toBe(true);
      expect(rail.strand.xs.at(-1)).toBeCloseTo(art.platform.x, 5);
      expect(rail.strand.ys.at(-1)).toBeCloseTo(rail.port.y, 5);
    }
  });

  it('spaces the ports evenly, top to bottom', () => {
    const ys = art.rails.map(rail => rail.port.y);
    const gaps = ys.slice(1).map((y, index) => y - (ys[index] ?? 0));

    for (const gap of gaps) {
      expect(gap).toBeCloseTo(gaps[0] ?? 0, 5);
      expect(gap).toBeGreaterThan(0);
    }
  });

  it('never lets two rails cross', () => {
    for (let x = art.agent.x + 40; x <= art.platform.x; x += 4) {
      const heights = art.rails.map(rail => heightAt(rail.strand.xs, rail.strand.ys, x));

      for (let index = 1; index < heights.length; index++) {
        expect(heights[index]).toBeGreaterThan(heights[index - 1] ?? Number.POSITIVE_INFINITY);
      }
    }
  });

  it('pins every rail at both ends', () => {
    for (const rail of art.rails) {
      expect(rail.strand.free[0]).toBe(0);
      expect(rail.strand.free.at(-1)).toBe(0);
      expect(Math.max(...rail.strand.free)).toBe(1);
    }
  });

  it('labels each port right of the platform, with room for the text', () => {
    for (const rail of art.rails) {
      expect(rail.label.at.x).toBeGreaterThan(art.platform.x);
      expect(rail.label.at.x).toBeLessThan(ART_WIDTH - 200);
      expect(rail.label.at.y).toBe(rail.port.y);
    }

    expect(art.rails.map(rail => rail.label.text)).toEqual(events);
  });
});

describe('helix', () => {
  const art = helix(300, 10, 70);

  it('is drawn one period wider than the canvas, so sliding it one period loops', () => {
    const last = art.dots.at(-1);

    expect(last?.x).toBeGreaterThanOrEqual(ART_WIDTH + art.period - 10);
  });

  it('mirrors its two strands about the middle', () => {
    for (let index = 0; index < art.dots.length; index += 2) {
      const shopper = art.dots[index];
      const agent = art.dots[index + 1];

      expect(shopper?.strand).toBe('shopper');
      expect(agent?.strand).toBe('agent');
      expect((shopper?.y ?? 0) + (agent?.y ?? 0)).toBeCloseTo(ART_HEIGHT, 0);
    }
  });

  it('repeats every period', () => {
    const at = (x: number) => art.dots.find(dot => dot.strand === 'shopper' && dot.x === x);

    expect(at(0)?.y).toBeCloseTo(at(300)?.y ?? Number.NaN, 5);
    expect(at(150)?.y).toBeCloseTo(at(450)?.y ?? Number.NaN, 5);
  });
});
