'use client';

import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { monotonePath, niceScale } from './geometry';
import { useElementWidth } from './use-element-width';
import type { Tone } from './verdict';

export interface ChartPoint {
  /** Axis text: the bucket's first day, or its month. */
  tick: string;
  /** The tooltip's heading: the bucket's span. */
  label: string;
  /** Under the heading, for a bucket the period clips. */
  note?: string;
  /** Clipped by the period's edge: fewer days than a full week or month. */
  partial?: boolean;
  value: number;
  /** The same days one period earlier. */
  previous: number;
}

const MARGIN = { top: 14, right: 14, bottom: 30, left: 58 };

/** The chart's neutrals on a dark card and on white. */
const TONES = {
  dark: {
    grid: 'rgba(255,255,255,0.06)',
    baseline: 'rgba(255,255,255,0.14)',
    axis: 'rgba(255,255,255,0.5)',
    previous: 'rgba(255,255,255,0.34)',
    crosshair: 'rgba(255,255,255,0.24)',
    previousDot: '#8a8a90',
    dotStroke: '#16161a',
    wash: 0.2,
    focusRing: 'focus-visible:ring-[#4f7dff]/60',
    tooltip: 'border-white/10 bg-[#0d0d0f] text-white shadow-[0_10px_28px_rgba(0,0,0,0.5)]',
    muted: 'text-white/50',
    label: 'text-white/70',
    labelMuted: 'text-white/55',
    value: 'text-white',
    valueMuted: 'text-white/70',
    dash: 'border-white/45',
  },
  light: {
    grid: 'rgba(25,25,25,0.06)',
    baseline: 'rgba(25,25,25,0.14)',
    axis: 'rgba(25,25,25,0.5)',
    previous: 'rgba(25,25,25,0.3)',
    crosshair: 'rgba(25,25,25,0.18)',
    previousDot: '#9a9a98',
    dotStroke: '#ffffff',
    wash: 0.14,
    focusRing: 'focus-visible:ring-[#4359ef]/40',
    tooltip: 'border-ink/10 bg-white text-ink shadow-[0_10px_28px_rgba(25,25,25,0.14)]',
    muted: 'text-ink/50',
    label: 'text-ink/70',
    labelMuted: 'text-ink/55',
    value: 'text-ink',
    valueMuted: 'text-ink/70',
    dash: 'border-ink/40',
  },
} as const;

/**
 * The large chart, for a dark card or for white (`tone`): this period as a 2px line over a 10%
 * wash, the previous period as a quiet dashed line under it, on one
 * zero-based axis with hairline gridlines.
 *
 * A bucket the period clips (the first or last week or month) holds fewer
 * days, so its value drops for no reason but the calendar. The line into
 * such a bucket is dotted rather than solid, as RevenueCat draws an
 * incomplete period, so the drop reads as "not all there" instead of as a
 * fall.
 *
 * Moving over it (or focusing it and using the arrow keys, Home and End)
 * puts a crosshair on the nearest bucket and shows both periods' values
 * there; a live region reads the same thing out.
 */
export function LineChart({
  points,
  height,
  color,
  formatValue,
  formatAxis,
  ariaLabel,
  seriesLabels,
  tone = 'dark',
}: {
  points: readonly ChartPoint[];
  height: number;
  color: string;
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  ariaLabel: string;
  seriesLabels: { current: string; previous: string };
  tone?: Tone;
}) {
  const colors = TONES[tone];
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const count = points.length;
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const scale = niceScale(Math.max(0, ...points.map((point) => Math.max(point.value, point.previous))));
  const x = (index: number) => MARGIN.left + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
  const y = (value: number) => MARGIN.top + plotHeight - (value / scale.max) * plotHeight;
  const baseline = y(0);
  const currentLine = monotonePath(points.map((point, index) => ({ x: x(index), y: y(point.value) })));
  const previousLine = monotonePath(points.map((point, index) => ({ x: x(index), y: y(point.previous) })));
  const wash = count > 1 ? `${currentLine}L${x(count - 1)},${baseline}L${x(0)},${baseline}Z` : '';
  // About one label per 88px, always including the first bucket.
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotWidth / 88))));
  const focus = active === null ? undefined : points[active];
  const firstPartial = count > 1 && points[0]?.partial === true;
  const lastPartial = count > 1 && points[count - 1]?.partial === true;
  const solidFrom = firstPartial ? x(1) : 0;
  const solidTo = lastPartial ? x(count - 2) : width;

  const clampIndex = (index: number) => Math.max(0, Math.min(count - 1, index));

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (count === 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - MARGIN.left) / Math.max(1, plotWidth);

    setActive(clampIndex(Math.round(ratio * (count - 1))));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;

    const current = active ?? count - 1;
    const next =
      event.key === 'ArrowLeft'
        ? current - 1
        : event.key === 'ArrowRight'
          ? current + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;

    if (event.key === 'Escape') {
      setActive(null);

      return;
    }

    if (next === null) return;

    event.preventDefault();
    setActive(clampIndex(active === null ? count - 1 : next));
  };

  const tooltipOnLeft = active !== null && x(active) > width - 230;

  return (
    <div
      ref={ref}
      className={cn('relative rounded-[12px] outline-none focus-visible:ring-2', colors.focusRing)}
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Use the left and right arrow keys to read each point.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          className="block"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`${id}-wash`} gradientUnits="userSpaceOnUse" x1="0" y1={MARGIN.top} x2="0" y2={baseline}>
              <stop offset="0" stopColor={color} stopOpacity={colors.wash} />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-solid`}>
              <rect x={solidFrom} y={0} width={Math.max(0, solidTo - solidFrom)} height={height} />
            </clipPath>
            <clipPath id={`${id}-partial`}>
              {firstPartial ? <rect x={0} y={0} width={x(1)} height={height} /> : null}
              {lastPartial ? <rect x={x(count - 2)} y={0} width={width - x(count - 2)} height={height} /> : null}
            </clipPath>
          </defs>

          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? colors.baseline : colors.grid}
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 12}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                fill={colors.axis}
                fontSize={11}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatAxis(tick)}
              </text>
            </g>
          ))}

          {points.map((point, index) =>
            index % labelEvery === 0 ? (
              <text
                key={`${point.tick}-${index}`}
                x={x(index)}
                y={height - 9}
                textAnchor={index === 0 && count > 1 ? 'start' : 'middle'}
                fill={colors.axis}
                fontSize={11}
              >
                {point.tick}
              </text>
            ) : null
          )}

          <path
            d={previousLine}
            fill="none"
            stroke={colors.previous}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          {wash ? <path d={wash} fill={`url(#${id}-wash)`} /> : null}
          <g clipPath={`url(#${id}-solid)`}>
            <path d={currentLine} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
          {firstPartial || lastPartial ? (
            <g clipPath={`url(#${id}-partial)`}>
              <path d={currentLine} fill="none" stroke={color} strokeWidth={2} strokeDasharray="0.5 5" strokeLinecap="round" />
            </g>
          ) : null}

          {focus && active !== null ? (
            <g>
              <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={baseline} stroke={colors.crosshair} strokeWidth={1} />
              <circle cx={x(active)} cy={y(focus.previous)} r={3.5} fill={colors.previousDot} stroke={colors.dotStroke} strokeWidth={2} />
              <circle cx={x(active)} cy={y(focus.value)} r={4.5} fill={color} stroke={colors.dotStroke} strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : null}

      {focus && active !== null ? (
        <div
          className={cn(
            'pointer-events-none absolute top-1 z-10 w-[210px] rounded-[12px] border px-3 py-2.5 text-[12px] leading-5',
            colors.tooltip
          )}
          style={tooltipOnLeft ? { right: width - x(active) + 14 } : { left: x(active) + 14 }}
        >
          <p className={cn('font-semibold', colors.value)}>{focus.label}</p>
          {focus.note ? <p className={colors.muted}>{focus.note}</p> : null}
          <div className="mt-1.5 flex items-center justify-between gap-4">
            <span className={cn('flex items-center gap-2', colors.label)}>
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: color }} />
              {seriesLabels.current}
            </span>
            <span className={cn('font-semibold tabular-nums', colors.value)}>{formatValue(focus.value)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className={cn('flex items-center gap-2', colors.labelMuted)}>
              <span className={cn('w-3 border-t-[1.5px] border-dashed', colors.dash)} />
              {seriesLabels.previous}
            </span>
            <span className={cn('tabular-nums', colors.valueMuted)}>{formatValue(focus.previous)}</span>
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {focus
          ? `${focus.label}: ${seriesLabels.current} ${formatValue(focus.value)}, ${seriesLabels.previous} ${formatValue(focus.previous)}`
          : ''}
      </p>
    </div>
  );
}

/**
 * The two series, named, for any chart with a previous period under it, and
 * the dotted line's meaning when the chart has a clipped bucket.
 */
export function ChartLegend({
  color,
  labels,
  partialLabel,
  tone = 'dark',
}: {
  color: string;
  labels: { current: string; previous: string };
  partialLabel?: string;
  tone?: Tone;
}) {
  const colors = TONES[tone];

  return (
    <ul className={cn('flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]', colors.label)}>
      <li className="flex items-center gap-2">
        <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
        {labels.current}
      </li>
      <li className="flex items-center gap-2">
        <span className={cn('w-4 border-t-[1.5px] border-dashed', colors.dash)} />
        {labels.previous}
      </li>
      {partialLabel ? (
        <li className="flex items-center gap-2">
          <span className="w-4 border-t-2 border-dotted" style={{ borderColor: color }} />
          {partialLabel}
        </li>
      ) : null}
    </ul>
  );
}
