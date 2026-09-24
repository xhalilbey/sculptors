import { describe, expect, it } from 'vitest';
import { changeBetween, directionOf, verdictOf } from './change';

describe('changeBetween', () => {
  it('gives the absolute and relative change', () => {
    expect(changeBetween(120, 100)).toEqual({ absolute: 20, ratio: 0.19999999999999996 });
  });

  it('has no ratio when there was nothing before', () => {
    expect(changeBetween(5, 0)).toEqual({ absolute: 5, ratio: null });
  });
});

describe('directionOf', () => {
  it('reads a change under a twentieth of a percent as flat', () => {
    expect(directionOf(changeBetween(10_004, 10_000))).toBe('flat');
    expect(directionOf(changeBetween(10_100, 10_000))).toBe('up');
    expect(directionOf(changeBetween(9_900, 10_000))).toBe('down');
  });

  it('uses the sign when there is no ratio', () => {
    expect(directionOf(changeBetween(3, 0))).toBe('up');
    expect(directionOf(changeBetween(0, 0))).toBe('flat');
  });
});

describe('verdictOf', () => {
  it('calls a rise good news only for metrics where more is better', () => {
    expect(verdictOf('up', true)).toBe('good');
    expect(verdictOf('up', false)).toBe('bad');
    expect(verdictOf('down', false)).toBe('good');
    expect(verdictOf('flat', false)).toBe('neutral');
  });
});
