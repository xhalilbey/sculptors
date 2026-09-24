/**
 * A value against the one before it, and whether that is good news. Pure;
 * shared by every panel that compares two periods (the Store Events Panel
 * and its metric pages).
 */

export interface Change {
  absolute: number;
  /** current / previous - 1; null when there was nothing before to compare with. */
  ratio: number | null;
}

export type Direction = 'up' | 'down' | 'flat';

/** Good or bad for the merchant, which depends on the metric, not the sign. */
export type Verdict = 'good' | 'bad' | 'neutral';

/** Under a twentieth of a percent reads as no change at one decimal. */
const FLAT_RATIO = 0.0005;

export function changeBetween(current: number, previous: number): Change {
  return {
    absolute: current - previous,
    ratio: previous === 0 ? null : current / previous - 1,
  };
}

export function directionOf(change: Change): Direction {
  if (change.ratio === null) {
    if (change.absolute > 0) return 'up';
    if (change.absolute < 0) return 'down';

    return 'flat';
  }

  if (Math.abs(change.ratio) < FLAT_RATIO) return 'flat';

  return change.ratio > 0 ? 'up' : 'down';
}

export function verdictOf(direction: Direction, higherIsBetter: boolean): Verdict {
  if (direction === 'flat') return 'neutral';

  return (direction === 'up') === higherIsBetter ? 'good' : 'bad';
}
