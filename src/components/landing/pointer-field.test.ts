import { describe, expect, it } from 'vitest';
import {
  bentPath,
  createPointer,
  movePointer,
  pushed,
  sampleCubic,
  settlePointer,
  smoothPath,
  STILL,
  strand,
  type Field,
  type Reach,
} from './pointer-field';

const REACH: Reach = { radius: 100, push: 30 };
const AT_ORIGIN: Field = { x: 0, y: 0, power: 1 };

describe('pushed', () => {
  it('pushes a point straight away from the pointer', () => {
    const [x, y] = pushed(30, 40, 1, AT_ORIGIN, REACH);

    expect(x).toBeGreaterThan(30);
    expect(y / x).toBeCloseTo(40 / 30, 10);
  });

  it('leaves alone what is out of reach, pinned, or under no power', () => {
    expect(pushed(120, 0, 1, AT_ORIGIN, REACH)).toEqual([120, 0]);
    expect(pushed(10, 0, 0, AT_ORIGIN, REACH)).toEqual([10, 0]);
    expect(pushed(10, 0, 1, STILL, REACH)).toEqual([10, 0]);
  });

  it('never folds a line: nearer points stay nearer', () => {
    let last = -1;

    for (let distance = 0.5; distance < REACH.radius; distance += 0.5) {
      const [x] = pushed(distance, 0, 1, AT_ORIGIN, REACH);

      expect(x).toBeGreaterThan(last);
      last = x;
    }
  });

  it('pushes a half-free point half as far', () => {
    const [full] = pushed(20, 0, 1, AT_ORIGIN, REACH);
    const [half] = pushed(20, 0, 0.5, AT_ORIGIN, REACH);

    expect(half - 20).toBeCloseTo((full - 20) / 2, 10);
  });
});

describe('the pointer', () => {
  it('gains power as it moves, to at most 1, and loses it when it stops', () => {
    const pointer = createPointer();

    for (let index = 0; index < 40; index++) {
      movePointer(pointer, 10, 10);
    }

    expect(pointer.power).toBe(1);

    for (let index = 0; index < 120; index++) {
      settlePointer(pointer, 1000 / 60);
    }

    expect(pointer.power).toBeLessThan(0.1);
  });

  it('is followed, not jumped to, once it is moving', () => {
    const pointer = createPointer();

    movePointer(pointer, 0, 0);
    movePointer(pointer, 0, 0);
    movePointer(pointer, 100, 0);
    settlePointer(pointer, 1000 / 60);

    expect(pointer.x).toBeGreaterThan(0);
    expect(pointer.x).toBeLessThan(100);
  });

  it('decays at nearly the same pace whatever the frame rate', () => {
    const at60 = createPointer();
    const at120 = createPointer();

    at60.power = 1;
    at120.power = 1;

    for (let index = 0; index < 60; index++) {
      settlePointer(at60, 1000 / 60);
    }

    for (let index = 0; index < 120; index++) {
      settlePointer(at120, 1000 / 120);
    }

    // Caretta's easing is frame-rate aware but not exact: within a few percent.
    expect(at120.power).toBeCloseTo(at60.power, 1);
  });
});

describe('strands', () => {
  const points = sampleCubic({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }, 13);
  const line = strand(points, t => 1 - t);

  it('sample a cubic from its start to its end', () => {
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points.at(-1)).toEqual({ x: 300, y: 0 });
  });

  it('draw a straight line straight', () => {
    const numbers = smoothPath([0, 50, 100], [0, 0, 0]).match(/-?[\d.]+/g)?.map(Number) ?? [];
    const ys = numbers.filter((_, index) => index % 2 === 1);

    expect(ys.length).toBeGreaterThan(0);
    expect(ys.every(y => y === 0)).toBe(true);
  });

  it('bend around the pointer, and not at a pinned end', () => {
    const d = bentPath(line, { x: 300, y: 10, power: 1 }, REACH);

    // The pinned end (t = 1, at x = 300) does not move.
    expect(d.endsWith('300 0')).toBe(true);

    const rest = bentPath(line, STILL, REACH);
    const bent = bentPath(line, { x: 20, y: 10, power: 1 }, REACH);

    expect(bent).not.toBe(rest);
    expect(bent.startsWith('M')).toBe(true);
  });
});
