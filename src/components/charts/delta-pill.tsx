import { directionOf, verdictOf, type Change, type Direction } from '@/lib/change';
import { cn } from '@/lib/utils';
import { VERDICT_PILL, type Tone } from './verdict';

const percents = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const DIRECTION_GLYPHS: Record<Direction, string> = { up: '▲', down: '▼', flat: '–' };

/** Signed, one decimal: "+12.4%", "−3.1%". "New" when there was nothing before. */
export function formatChange(change: Change): string {
  if (change.ratio === null) return change.absolute === 0 ? '0.0%' : 'New';

  const text = percents.format(Math.abs(change.ratio));

  if (text === percents.format(0)) return text;

  return `${change.ratio > 0 ? '+' : '\u2212'}${text}`;
}

/** The change in words, for screen readers. */
export function describeChange(change: Change, direction: Direction): string {
  if (change.ratio === null) {
    return change.absolute === 0 ? 'No change on the comparison period' : 'New this period';
  }

  if (direction === 'flat') return 'No change on the comparison period';

  return `${direction === 'up' ? 'Up' : 'Down'} ${percents.format(Math.abs(change.ratio))} on the comparison period`;
}

/**
 * The change on the comparison period: an arrow, a signed percentage, and a
 * colour for whether it is good news -- which for cancellations, refunds,
 * latency or errors means going down. The colour is never the only signal.
 */
export function DeltaPill({
  change,
  higherIsBetter,
  tone = 'dark',
  className,
}: {
  change: Change;
  higherIsBetter: boolean;
  /** The surface it sits on: a dark card, or the white page. */
  tone?: Tone;
  className?: string;
}) {
  const direction = directionOf(change);
  const verdict = verdictOf(direction, higherIsBetter);

  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-semibold tabular-nums',
        VERDICT_PILL[tone][verdict],
        className
      )}
    >
      <span aria-hidden="true" className="text-[9px]">
        {DIRECTION_GLYPHS[direction]}
      </span>
      <span aria-hidden="true">{formatChange(change)}</span>
      <span className="sr-only">{describeChange(change, direction)}</span>
    </span>
  );
}
