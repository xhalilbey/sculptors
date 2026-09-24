'use client';

import { useId, useMemo, type Ref } from 'react';
import { cellsOf, sceneOf, type Face, type FaceKind, type VoxelScene } from './voxel-scene';

/**
 * The block numerals, twice over: an ink drawing of white blocks, and under
 * a lantern that follows the pointer (--lantern-x / --lantern-y, set by the
 * page), the same blocks lit in the brand's button blue. Idea after
 * Cursor's 404; the geometry is ours (voxel-scene.ts).
 */

/** The unlit blocks, on a light page and on a dark panel. */
const INK = {
  light: { front: '#ffffff', top: '#f1f1ed', side: '#e4e4df', edge: 'rgba(25,25,25,0.34)' },
  dark: { front: '#1b1b1e', top: '#27272b', side: '#121214', edge: 'rgba(255,255,255,0.24)' },
} as const;
const LIT: Record<Exclude<FaceKind, 'front'>, string> = { top: '#9eaefc', side: '#2e3ecb' };

function pointsOf(face: Face): string {
  return face.points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
}

function Layer({
  scene,
  frontFill,
  fills,
  stroke,
  strokeWidth,
}: {
  scene: VoxelScene;
  frontFill: string;
  fills: Record<Exclude<FaceKind, 'front'>, string>;
  stroke: string;
  strokeWidth: number;
}) {
  return (
    <>
      {scene.faces.map((face, index) => {
        const fill = face.kind === 'front' ? frontFill : fills[face.kind];

        return (
          <g key={index}>
            {/* Stroked in its own fill: adjacent polygons otherwise leave
              hairline anti-aliasing gaps, which show as a grid on the lit
              blue layer. */}
            <polygon
              points={pointsOf(face)}
              fill={fill}
              stroke={fill}
              strokeWidth={1}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {face.edges.map(([from, to], edge) => (
              <line
                key={edge}
                x1={from[0]}
                y1={from[1]}
                x2={to[0]}
                y2={to[1]}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
    </>
  );
}

export function VoxelArt({
  text,
  frameRef,
  tone = 'light',
}: {
  text: string;
  frameRef?: Ref<HTMLDivElement>;
  tone?: 'light' | 'dark';
}) {
  const ink = INK[tone];
  const scene = useMemo(() => sceneOf(cellsOf(text)), [text]);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { x, y, width, height } = scene.viewBox;
  const viewBox = `${x} ${y} ${width} ${height}`;
  const lantern =
    'radial-gradient(circle 190px at var(--lantern-x, 34%) var(--lantern-y, 44%), #000 30%, transparent 100%)';

  return (
    <div
      ref={frameRef}
      className="relative mx-auto w-full max-w-[560px] select-none"
      aria-hidden="true"
    >
      <svg viewBox={viewBox} className="block h-auto w-full">
        <Layer
          scene={scene}
          frontFill={ink.front}
          fills={{ top: ink.top, side: ink.side }}
          stroke={ink.edge}
          strokeWidth={1}
        />
      </svg>
      <svg
        viewBox={viewBox}
        className="absolute inset-0 block h-auto w-full"
        style={{ maskImage: lantern, WebkitMaskImage: lantern }}
      >
        <defs>
          {/* One gradient across the whole scene, not one per cell: in the
              default bounding-box units every cube restarted it and the
              lit fronts read as a grid. */}
          <linearGradient
            id={`${id}-front`}
            gradientUnits="userSpaceOnUse"
            x1={x}
            y1={y}
            x2={x + width}
            y2={y + height}
          >
            <stop offset="0" stopColor="#6a7ffa" />
            <stop offset="0.52" stopColor="#4359ef" />
            <stop offset="1" stopColor="#3446dd" />
          </linearGradient>
        </defs>
        <Layer
          scene={scene}
          frontFill={`url(#${id}-front)`}
          fills={LIT}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth={1.25}
        />
      </svg>
    </div>
  );
}
