import { describe, expect, it } from 'vitest';
import { ENGINE_HEIGHT, ENGINE_WIDTH, flame, lightning, sphere } from './engine-art';

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

describe('sphere', () => {
  const globe = sphere(300);

  it('keeps every point inside its circle', () => {
    for (const point of globe.points) {
      const distance = Math.hypot(point.x - globe.center.x, point.y - globe.center.y);

      expect(distance).toBeLessThanOrEqual(globe.radius + 0.1);
    }
  });

  it('draws nearer points larger and stronger', () => {
    const sorted = [...globe.points].sort((a, b) => a.r - b.r);
    const faint = sorted[0];
    const strong = sorted.at(-1);

    expect(faint?.o).toBeLessThan(strong?.o ?? 0);
  });
});
