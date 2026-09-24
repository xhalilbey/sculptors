'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { VoxelArt } from './voxel-art';

/** A faint isometric grid, the numerals' ground, fading out toward the edges. */
function gridOf(line: string) {
  return (
    `repeating-linear-gradient(30deg, ${line} 0 1px, transparent 1px 34px),` +
    `repeating-linear-gradient(150deg, ${line} 0 1px, transparent 1px 34px)`
  );
}

const TONES = {
  light: {
    surface: 'bg-[#fbfbfa] text-ink',
    text: 'text-ink',
    grid: gridOf('rgba(25,25,25,0.055)'),
    eyebrow: 'text-[#4359ef]',
    body: 'text-ink/60',
  },
  // On the dashboard's dark panel: the panel's own ground shows through.
  dark: {
    surface: 'bg-[#0d0d0f] text-white',
    text: 'text-white',
    grid: gridOf('rgba(255,255,255,0.05)'),
    eyebrow: 'text-[#8fa2ff]',
    body: 'text-white/60',
  },
} as const;
const GRID_FADE = 'radial-gradient(ellipse 70% 65% at 32% 48%, #000 25%, transparent 100%)';

/**
 * The page every dead end shows -- a missing page, a crash -- after
 * Cursor's 404, which the owner pointed to (23 Sep 2026): large block
 * numerals on an isometric grid, lit in the brand blue wherever the pointer
 * is, and beside them one plain sentence and the way out.
 *
 * `fill` is the screen for pages of their own and the container for an
 * error inside the dashboard shell, where the rail stays usable; `tone` is
 * dark there, on the dashboard's dark panel.
 */
export function ErrorScene({
  code,
  eyebrow,
  title,
  body,
  actions,
  fill = 'screen',
  tone = 'light',
}: {
  code: string;
  eyebrow: string;
  title: string;
  body: string;
  actions: ReactNode;
  fill?: 'screen' | 'container';
  tone?: 'light' | 'dark';
}) {
  const art = useRef<HTMLDivElement>(null);
  const colors = TONES[tone];

  // The lantern follows the pointer anywhere on the page, not just over the
  // numerals, so moving toward the button still lights them.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = art.current;

    if (!node) return;

    const bounds = node.getBoundingClientRect();

    node.style.setProperty('--lantern-x', `${event.clientX - bounds.left}px`);
    node.style.setProperty('--lantern-y', `${event.clientY - bounds.top}px`);
  };

  return (
    <div
      onPointerMove={onPointerMove}
      className={cn(
        'relative isolate flex items-center overflow-hidden',
        // On a page of its own it paints its ground; inside the dashboard the
        // page's own ground shows through.
        fill === 'screen' ? cn('min-h-screen', colors.surface) : cn('min-h-full', colors.text)
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: colors.grid, maskImage: GRID_FADE, WebkitMaskImage: GRID_FADE }}
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.15fr_1fr] lg:px-10">
        <VoxelArt text={code} frameRef={art} tone={tone} />
        <div className="max-w-md">
          <p className={cn('text-[13px] font-semibold uppercase tracking-[0.14em]', colors.eyebrow)}>{eyebrow}</p>
          <h1 className="mt-3 text-[40px] font-bold leading-[1.08] tracking-[-0.03em]">{title}</h1>
          <p className={cn('mt-4 text-[16px] leading-7', colors.body)}>{body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
        </div>
      </div>
    </div>
  );
}
