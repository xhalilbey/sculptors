import { describe, expect, it } from 'vitest';
import { ART_HEIGHT, ART_WIDTH, converge, fanOut, helix, seeded } from './journey-art';

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

describe('fanOut', () => {
  const art = fanOut(['delivery update', 'review asked'], 24);

  it('starts every line at the order', () => {
    for (const line of art.lines) {
      expect(line.d.startsWith(`M${art.order.x} ${art.order.y}`)).toBe(true);
      expect(line.end.x).toBeGreaterThan(art.order.x);
    }
  });

  it('labels in a column right of every dot, with room left for the text', () => {
    const rightmostDot = Math.max(...art.lines.map(line => line.end.x));

    for (const label of art.labels) {
      expect(label.at.x).toBeGreaterThan(rightmostDot);
      expect(label.at.x).toBeLessThan(ART_WIDTH - 200);
    }
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
