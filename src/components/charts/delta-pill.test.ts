import { describe, expect, it } from 'vitest';
import { changeBetween } from '@/lib/change';
import { formatChange } from './delta-pill';

describe('formatChange', () => {
  it('signs the change, with a real minus, at one decimal', () => {
    expect(formatChange(changeBetween(112.4, 100))).toBe('+12.4%');
    expect(formatChange(changeBetween(96.9, 100))).toBe('\u22123.1%');
  });

  it('says New when there was nothing before, and shows no sign on no change', () => {
    expect(formatChange(changeBetween(4, 0))).toBe('New');
    expect(formatChange(changeBetween(100.01, 100))).toBe('0.0%');
  });
});
