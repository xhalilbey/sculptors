export interface Point {
  x: number;
  y: number;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A smooth line through the points that never overshoots them (monotone
 * cubic, Fritsch-Carlson): the wave the owner asked for, without inventing a
 * peak or a dip between two buckets that the data does not have.
 */
export function monotonePath(points: readonly Point[]): string {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const count = xs.length;
  const at = (values: readonly number[], index: number) => values[index] ?? 0;

  if (count === 0) return '';
  if (count === 1) return `M${round(at(xs, 0))},${round(at(ys, 0))}`;

  const secants: number[] = [];

  for (let index = 0; index < count - 1; index += 1) {
    const width = at(xs, index + 1) - at(xs, index);

    secants.push(width === 0 ? 0 : (at(ys, index + 1) - at(ys, index)) / width);
  }

  const tangents = Array.from({ length: count }, (_, index) => {
    if (index === 0) return at(secants, 0);
    if (index === count - 1) return at(secants, count - 2);

    const before = at(secants, index - 1);
    const after = at(secants, index);

    return before * after <= 0 ? 0 : (before + after) / 2;
  });

  for (let index = 0; index < count - 1; index += 1) {
    const secant = at(secants, index);

    if (secant === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }

    const alpha = at(tangents, index) / secant;
    const beta = at(tangents, index + 1) / secant;
    const length = alpha * alpha + beta * beta;

    if (length > 9) {
      const tau = 3 / Math.sqrt(length);

      tangents[index] = tau * alpha * secant;
      tangents[index + 1] = tau * beta * secant;
    }
  }

  let path = `M${round(at(xs, 0))},${round(at(ys, 0))}`;

  for (let index = 0; index < count - 1; index += 1) {
    const x0 = at(xs, index);
    const x1 = at(xs, index + 1);
    const y0 = at(ys, index);
    const y1 = at(ys, index + 1);
    const third = (x1 - x0) / 3;

    path +=
      `C${round(x0 + third)},${round(y0 + at(tangents, index) * third)},` +
      `${round(x1 - third)},${round(y1 - at(tangents, index + 1) * third)},${round(x1)},${round(y1)}`;
  }

  return path;
}

/**
 * A zero-based axis whose top and steps are round numbers (1, 2, 2.5 or 5
 * times a power of ten), with about `tickCount` steps.
 */
export function niceScale(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: 1, ticks: [0] };

  const rough = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const factor = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  const step = factor * magnitude;
  const steps = Math.ceil(maxValue / step);

  return { max: steps * step, ticks: Array.from({ length: steps + 1 }, (_, index) => index * step) };
}

/**
 * Where a key moves a chart's focused bucket, given the bucket in focus
 * (`active`, or null for none) and how many there are: an index, 'clear'
 * for Escape, or null for a key the chart does not handle.
 *
 * With nothing in focus, the first arrow press shows the latest bucket, the
 * one a reader most often wants; Home and End still mean the first and the
 * last. The chart used to send every first press to the latest bucket, so
 * Home landed on the end of the line.
 */
export function keyTarget(key: string, active: number | null, count: number): number | 'clear' | null {
  if (key === 'Escape') return 'clear';
  if (count === 0) return null;

  const last = count - 1;
  const clamp = (index: number) => Math.max(0, Math.min(last, index));

  switch (key) {
    case 'ArrowLeft':
      return active === null ? last : clamp(active - 1);
    case 'ArrowRight':
      return active === null ? last : clamp(active + 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}
