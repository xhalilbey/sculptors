import { describe, expect, it } from 'vitest';
import { ARMILLARY, armillary, ENGINE_HEIGHT, ENGINE_WIDTH, flame, lightning, orient, RINGS } from './engine-art';

describe('lightning', () => {
  const bolt = lightning(6);

  it('forks at every step: 2^depth - 1 segments and 2^(depth-1) tips', () => {
    expect(bolt.strokes).toHaveLength(2 ** 6 - 1);
    expect(bolt.tips).toHaveLength(2 ** 5);
  });

  it('grows upwards from its root and stays on the card', () => {
    for (const tip of bolt.tips) {
      expect(tip.y).toBeLessThan(bolt.root.y);
      expect(tip.x).toBeGreaterThan(0);
      expect(tip.x).toBeLessThan(ENGINE_WIDTH);
      expect(tip.y).toBeGreaterThan(0);
    }
  });

  it('draws the same bolt every time', () => {
    expect(lightning(6).strokes).toEqual(bolt.strokes);
  });

  it('routes every event from the root to one tip, along the bolt', () => {
    expect(bolt.branches).toHaveLength(bolt.tips.length);

    bolt.branches.forEach((branch, index) => {
      expect(branch.points[0]).toEqual(bolt.root);
      expect(branch.points.at(-1)).toEqual(bolt.tips[index]);
      // root, then a kink and an end for each of the six strokes
      expect(branch.points).toHaveLength(1 + 2 * 6);
    });
  });

  it('pins the bolt at its root and frees it towards the tips', () => {
    const first = bolt.strokes[0];

    expect(first?.strand.free[0]).toBe(0);

    for (const branch of bolt.branches) {
      expect(branch.strand.free.at(-1)).toBeGreaterThan(0.9);
    }
  });
});

describe('flame', () => {
  it('meets at one point near the top, from the bottom edge', () => {
    const { streams, top } = flame(12);

    expect(streams).toHaveLength(12);

    for (const stream of streams) {
      expect(stream.d.startsWith('M')).toBe(true);
      expect(stream.d).toContain(` ${ENGINE_HEIGHT} `);
      expect(stream.d.endsWith(`${top.x} ${top.y}`)).toBe(true);
    }
  });
});

describe('armillary', () => {
  const { center, radius, rest } = ARMILLARY;

  it('turns vectors without stretching them', () => {
    const v = orient([0.3, -0.5, 0.81], { spin: 1.2, tilt: 0.4, lean: -0.3 });

    expect(Math.hypot(...v)).toBeCloseTo(Math.hypot(0.3, -0.5, 0.81), 10);
  });

  it("draws every great circle at the sphere's full size", () => {
    const frame = armillary(rest, 0, 0);

    frame.rings.forEach((ring, index) => {
      expect(ring.ry).toBeLessThanOrEqual(ring.rx);

      if (RINGS[index]?.offset === 0) {
        expect(ring.rx).toBeCloseTo(radius, 1);
      }
    });
  });

  it("puts every request on its own ring's ellipse, so the rings and the requests agree", () => {
    const frame = armillary({ spin: 1.3, tilt: 0.42, lean: -0.25 }, 4.1, 1);
    let first = 0;

    frame.rings.forEach((ring, index) => {
      const slots = RINGS[index]?.slots ?? 0;
      const angle = (ring.angle * Math.PI) / 180;

      for (const request of frame.requests.slice(first, first + slots)) {
        const dx = request.x - ring.cx;
        const dy = request.y - ring.cy;
        const along = dx * Math.cos(angle) + dy * Math.sin(angle);
        const across = -dx * Math.sin(angle) + dy * Math.cos(angle);

        if (ring.ry > 8) {
          expect(Math.hypot(along / ring.rx, across / ring.ry)).toBeCloseTo(1, 1);
        }
      }

      first += slots;
    });
  });

  it('keeps every request on the sphere and on the card', () => {
    const frame = armillary({ spin: 2.1, tilt: 0.5, lean: -0.1 }, 7.3, 1);

    for (const request of frame.requests) {
      expect(Math.hypot(request.x - center.x, request.y - center.y)).toBeLessThanOrEqual(radius + 0.2);
      expect(request.y).toBeGreaterThan(0);
      expect(request.y).toBeLessThan(ENGINE_HEIGHT);
    }
  });

  it('shows only the base requests at rest, and every one under full load', () => {
    const base = RINGS.reduce((sum, ring) => sum + ring.base, 0);
    const slots = RINGS.reduce((sum, ring) => sum + ring.slots, 0);
    const shown = (load: number) => armillary(rest, 3, load).requests.filter(request => request.o > 0).length;

    expect(shown(0)).toBe(base);
    expect(shown(1)).toBe(slots);
    expect(shown(0.5)).toBeGreaterThan(base);
    expect(shown(0.5)).toBeLessThan(slots);
  });

  it('draws the same first frame on the server and in the browser', () => {
    expect(armillary(rest, 0, 0)).toEqual(armillary(rest, 0, 0));
  });
});
