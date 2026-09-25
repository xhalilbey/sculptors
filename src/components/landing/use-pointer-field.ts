import { useEffect, useRef, type RefObject } from 'react';
import {
  bentPath,
  bentPolyline,
  createPointer,
  inReach,
  movePointer,
  pushed,
  settlePointer,
  STILL,
  type Field,
  type Reach,
  type Strand,
} from './pointer-field';

/**
 * Draws one frame of a drawing: `field` is the pointer (STILL when there is
 * none), `time` the drawing's own clock in ms, which only runs while the
 * drawing is on screen, and `dt` the frame's length.
 */
export type FrameDraw = (field: Field, time: number, dt: number) => void;

type Options = {
  /** The drawing moves on its own, so it is drawn every frame it is on screen. */
  readonly continuous?: boolean;
};

/**
 * Drives a drawing's hover (pointer-field.ts): follows the pointer over the
 * SVG's parent, and calls `draw` once a frame while the field is alive --
 * or every frame, for a drawing that moves on its own -- and only while
 * the drawing is on screen. `setup` runs once, with the mounted SVG, and
 * returns the frame's draw, so it can find its elements once.
 *
 * The drawing's markup is its rest state, rendered on the server; frames
 * write attributes straight onto those elements, outside React, and the
 * last frame of a hover puts the rest state back. Under reduced motion
 * nothing is driven, and the rest state is what shows.
 */
export function usePointerField(
  svgRef: RefObject<SVGSVGElement | null>,
  setup: (svg: SVGSVGElement) => FrameDraw,
  options: Options = {}
): void {
  const setupRef = useRef(setup);
  const continuous = options.continuous === true;

  useEffect(() => {
    const svg = svgRef.current;
    const host = svg?.parentElement;

    if (!svg || !host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const draw = setupRef.current(svg);
    const box = svg.viewBox.baseVal;
    const pointer = createPointer();
    let frame = 0;
    let last = 0;
    let clock = 0;
    let visible = false;
    let stirred = false;

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min(64, now - last) : 1000 / 60;

      last = now;
      clock += dt;
      settlePointer(pointer, dt);

      const alive = pointer.power > 0.002;

      if (alive || stirred || continuous) {
        draw(alive ? { x: pointer.x, y: pointer.y, power: pointer.power } : STILL, clock, dt);
      }

      // The frame after the field dies draws the rest state once; then the
      // loop sleeps until the pointer or the drawing needs it again.
      stirred = alive;

      if (!alive) {
        pointer.power = 0;
      }

      if (visible && (alive || continuous)) {
        frame = window.requestAnimationFrame(tick);
      } else {
        last = 0;
      }
    };

    const wake = () => {
      if (!frame && visible) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    const move = (event: PointerEvent) => {
      const rect = svg.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      // From the page to the drawing's units. The SVG keeps its viewBox's
      // proportions, so one scale per axis is exact -- and, unlike
      // getScreenCTM, the client rect includes the reveal's CSS transform.
      movePointer(
        pointer,
        box.x + ((event.clientX - rect.left) / rect.width) * box.width,
        box.y + ((event.clientY - rect.top) / rect.height) * box.height
      );
      wake();
    };

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      wake();
    });

    seen.observe(svg);
    host.addEventListener('pointermove', move);

    return () => {
      seen.disconnect();
      host.removeEventListener('pointermove', move);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [svgRef, continuous]);
}

/* ---- painters: a frame's writes, for the common shapes ------------------- */

const r1 = (n: number) => String(Math.round(n * 10) / 10);

/**
 * Bends lines drawn as paths marked `data-strand="{key}-{index}"` -- a line
 * and, say, the pulse riding it share one key, so they bend as one. A line
 * out of reach is left alone, and put back once when the field leaves it.
 */
export function strandPainter(
  svg: SVGSVGElement,
  key: string,
  lines: ReadonlyArray<{ readonly d: string; readonly strand: Strand }>,
  reach: Reach,
  shape: 'smooth' | 'straight' = 'smooth'
): (field: Field) => void {
  const paths = lines.map((_, index) => [...svg.querySelectorAll<SVGPathElement>(`[data-strand="${key}-${index}"]`)]);
  const bent = lines.map(() => false);
  const bend = shape === 'smooth' ? bentPath : bentPolyline;

  return field => {
    lines.forEach((line, index) => {
      const near = inReach(line.strand, field, reach);

      if (!near && !bent[index]) {
        return;
      }

      const d = near ? bend(line.strand, field, reach) : line.d;

      for (const path of paths[index] ?? []) {
        path.setAttribute('d', d);
      }

      bent[index] = near;
    });
  };
}

/** Moves circles marked `data-dot="{key}-{index}"` off their rest centres. */
export function dotPainter(
  svg: SVGSVGElement,
  key: string,
  dots: ReadonlyArray<{ readonly x: number; readonly y: number; readonly free?: number }>,
  reach: Reach
): (field: Field) => void {
  const circles = dots.map((_, index) => svg.querySelector<SVGCircleElement>(`[data-dot="${key}-${index}"]`));
  const moved = dots.map(() => false);

  return field => {
    dots.forEach((dot, index) => {
      const [x, y] = pushed(dot.x, dot.y, dot.free ?? 1, field, reach);
      const shifted = x !== dot.x || y !== dot.y;
      const circle = circles[index];

      if (!circle || (!shifted && !moved[index])) {
        return;
      }

      circle.setAttribute('cx', r1(x));
      circle.setAttribute('cy', r1(y));
      moved[index] = shifted;
    });
  };
}
