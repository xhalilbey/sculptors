'use client';

import { useId, useState, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { monotonePath } from './geometry';
import { useElementWidth } from './use-element-width';
import type { Tone } from './verdict';

const INSET = 5;

const TONES = {
  dark: {
    crosshair: 'rgba(255,255,255,0.18)',
    dotStroke: '#18181b',
    wash: 0.22,
    tooltip: 'border-white/10 bg-[#0d0d0f] text-white/85 shadow-[0_6px_16px_rgba(0,0,0,0.45)]',
    muted: 'text-white/55',
  },
  light: {
    crosshair: 'rgba(25,25,25,0.16)',
    dotStroke: '#ffffff',
    wash: 0.16,
    tooltip: 'border-ink/10 bg-white text-ink shadow-[0_6px_16px_rgba(25,25,25,0.12)]',
    muted: 'text-ink/55',
  },
} as const;

/**
 * A tile's trend: the period's buckets as one smooth line, drawn in light
 * that fades in from the left (the owner's reference: lines that are drawn
 * by light and die away, not wireframes), with a soft wash under it and a
 * dot on the latest bucket. The scale is the series' own min to max, as a
 * sparkline's should be: it shows the shape, the band under it the number.
 *
 * Hovering shows the bucket under the pointer. It is decoration for the
 * pointer only; the number and the delta pill carry the meaning, and the
 * metric's own page has the table.
 */
export function Sparkline({
  values,
  labels,
  color,
  format,
  height = 60,
  tone = 'dark',
}: {
  values: readonly number[];
  labels: readonly string[];
  color: string;
  format: (value: number) => string;
  height?: number;
  /** The card it is drawn on. */
  tone?: Tone;
}) {
  const colors = TONES[tone];
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const count = values.length;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const x = (index: number) => (count <= 1 ? width / 2 : INSET + (index / (count - 1)) * (width - INSET * 2));
  const y = (value: number) => INSET + (1 - (value - min) / span) * (height - INSET * 2);
  const points = values.map((value, index) => ({ x: x(index), y: y(value) }));
  const line = monotonePath(points);
  const area = count > 1 ? `${line}L${x(count - 1)},${height}L${x(0)},${height}Z` : '';
  const last = points[count - 1];
  const focus = active === null ? undefined : points[active];
  const focusValue = active === null ? undefined : values[active];

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - INSET) / Math.max(1, bounds.width - INSET * 2);

    setActive(Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1)))));
  };

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && count > 0 ? (
        <svg
          width={width}
          height={height}
          className="block overflow-visible"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.38" stopColor="#fff" stopOpacity="1" />
              <stop offset="1" stopColor="#fff" stopOpacity="1" />
            </linearGradient>
            <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="-4" width={width} height={height + 8}>
              <rect x="0" y="-4" width={width} height={height + 8} fill={`url(#${id}-fade)`} />
            </mask>
            <linearGradient id={`${id}-wash`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
              <stop offset="0" stopColor={color} stopOpacity={colors.wash} />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g mask={`url(#${id}-mask)`}>
            {area ? <path d={area} fill={`url(#${id}-wash)`} /> : null}
            <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
          {focus ? (
            <line x1={focus.x} x2={focus.x} y1={0} y2={height} stroke={colors.crosshair} strokeWidth={1} />
          ) : null}
          {(focus ?? last) ? (
            <circle
              cx={(focus ?? last)?.x}
              cy={(focus ?? last)?.y}
              r={3.5}
              fill={color}
              stroke={colors.dotStroke}
              strokeWidth={2}
            />
          ) : null}
        </svg>
      ) : null}
      {focus && active !== null && focusValue !== undefined ? (
        <div
          className={cn(
            'pointer-events-none absolute -top-2 z-10 whitespace-nowrap rounded-[8px] border px-2 py-1 text-[11px] leading-4',
            colors.tooltip
          )}
          style={
            focus.x > width / 2
              ? { right: width - focus.x + 8 }
              : { left: focus.x + 8 }
          }
        >
          <span className={colors.muted}>{labels[active]}</span>
          <span className="ml-2 font-semibold tabular-nums">{format(focusValue)}</span>
        </div>
      ) : null}
    </div>
  );
}
