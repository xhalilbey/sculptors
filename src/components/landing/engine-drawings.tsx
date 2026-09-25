'use client';

import { useRef, type CSSProperties } from 'react';
import { ARMILLARY, armillary, ENGINE_HEIGHT, ENGINE_WIDTH, flame, lightning, type Pose } from './engine-art';
import { seeded } from './journey-art';
import type { Reach } from './pointer-field';
import { dotPainter, strandPainter, usePointerField } from './use-pointer-field';

/*
 * The engine cards' drawings (engine-art.ts), alive: each answers the
 * pointer the way caretta.so's drawings do (pointer-field.ts), and each
 * moves on its own the way its engine works -- events running up Zeus's
 * bolt, sparks up Prometheus's streams, requests around Atlas's rings.
 * Flat light on the navy card: no glow, no blur.
 */

/** On a 400-wide card, the pointer reaches a quarter of the way across. */
const REACH: Reach = { radius: 92, push: 20 };

const BOLT = lightning();
const FIRE = flame();

/** Events run up one route in three, each on its own beat (a phase into the 4.2s cycle). */
const phases = seeded(17);

phases(); // a small seed's first draw is always near 0

const PULSED = BOLT.branches
  .map((branch, index) => ({ ...branch, index }))
  .filter(branch => branch.index % 3 === 0)
  .map(branch => ({ ...branch, phase: Math.round(phases() * 42) / 10 }));

const beat = (phase: number): CSSProperties => ({ '--phase': `${phase}s` }) as CSSProperties;

export function LightningDrawing() {
  const svgRef = useRef<SVGSVGElement>(null);

  usePointerField(svgRef, svg => {
    const bolt = strandPainter(svg, 'bolt', BOLT.strokes, REACH, 'straight');
    const events = strandPainter(
      svg,
      'event',
      PULSED.map(branch => ({ d: polyline(branch.points), strand: branch.strand })),
      REACH,
      'straight'
    );
    const tips = dotPainter(
      svg,
      'tip',
      BOLT.branches.map(branch => ({ ...(branch.points.at(-1) ?? BOLT.root), free: branch.strand.free.at(-1) ?? 1 })),
      REACH
    );

    return field => {
      bolt(field);
      events(field);
      tips(field);
    };
  });

  const pulsedTips = new Set(PULSED.map(branch => branch.index));

  return (
    <svg ref={svgRef} viewBox={`0 0 ${ENGINE_WIDTH} ${ENGINE_HEIGHT}`} className="engine-svg">
      {BOLT.strokes.map((stroke, index) => (
        <path
          key={index}
          d={stroke.d}
          pathLength={1}
          data-strand={`bolt-${index}`}
          className="engine-bolt"
          style={
            {
              strokeWidth: Math.max(0.6, 2.4 - stroke.level * 0.3),
              opacity: 1 - (stroke.level - 1) * 0.13,
              '--level': stroke.level,
            } as CSSProperties
          }
        />
      ))}
      {/* An event runs from the root up one route, and the memory it lands on ticks. */}
      {PULSED.map((branch, order) => (
        <path
          key={branch.index}
          d={polyline(branch.points)}
          pathLength={1}
          data-strand={`event-${order}`}
          className="engine-pulse"
          style={beat(branch.phase)}
        />
      ))}
      {BOLT.tips.map((tip, index) => {
        const pulse = PULSED.find(branch => branch.index === index);

        return (
          <circle
            key={index}
            cx={tip.x}
            cy={tip.y}
            r={1.5}
            data-dot={`tip-${index}`}
            className={pulsedTips.has(index) ? 'engine-tip is-pulsed' : 'engine-tip'}
            style={pulse ? beat(pulse.phase) : undefined}
          />
        );
      })}
      <circle cx={BOLT.root.x} cy={BOLT.root.y} r={4} className="engine-core" />
    </svg>
  );
}

function polyline(points: ReadonlyArray<{ readonly x: number; readonly y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
}

export function FlameDrawing({ id }: { readonly id: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  usePointerField(svgRef, svg => strandPainter(svg, 'stream', FIRE.streams, REACH));

  return (
    <svg ref={svgRef} viewBox={`0 0 ${ENGINE_WIDTH} ${ENGINE_HEIGHT}`} className="engine-svg">
      <defs>
        <linearGradient id={`${id}-rise`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={ENGINE_HEIGHT} y2={FIRE.top.y}>
          <stop offset="0" style={{ stopColor: 'var(--engine-accent)', stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: 'var(--engine-accent)', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      {FIRE.streams.map((stream, index) => (
        <path key={index} d={stream.d} data-strand={`stream-${index}`} className="engine-stream" stroke={`url(#${id}-rise)`} />
      ))}
      {/* Sparks travelling up each stream: the data, as it is processed. */}
      {FIRE.streams.map((stream, index) => (
        <path
          key={index}
          d={stream.d}
          pathLength={1}
          data-strand={`stream-${index}`}
          className="engine-spark"
          style={{ '--t': stream.t } as CSSProperties}
        />
      ))}
      <circle cx={FIRE.top.x} cy={FIRE.top.y} r={4} className="engine-core" />
    </svg>
  );
}

/** Atlas turns once in 40 seconds at rest, and up to three times as fast under a hand. */
const SPIN = (Math.PI * 2) / 40;
const FIRST = armillary(ARMILLARY.rest, 0, 0);

export function ArmillaryDrawing({ id }: { readonly id: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  usePointerField(
    svgRef,
    svg => {
      const rings = [...svg.querySelectorAll<SVGEllipseElement>('.engine-ring')];
      const fades = [...svg.querySelectorAll<SVGLinearGradientElement>('[data-fade]')];
      const requests = [...svg.querySelectorAll<SVGCircleElement>('.engine-request')];
      const axis = svg.querySelector<SVGLineElement>('.engine-axis');
      const poles = [...svg.querySelectorAll<SVGCircleElement>('.engine-pole')];
      let spin = ARMILLARY.rest.spin;
      let load = 0;

      return (field, time, dt) => {
        const { center } = ARMILLARY;
        const lean = Math.max(-1, Math.min(1, (field.x - center.x) / 200));
        const tip = Math.max(-1, Math.min(1, (field.y - center.y) / 140));

        // A hand over it is load: the sphere turns faster and more requests
        // join the rings, then it settles back when the hand stops.
        spin += SPIN * (1 + 2 * field.power) * (dt / 1000);
        load += (field.power - load) * Math.min(1, dt / 240);

        const pose: Pose = {
          spin,
          tilt: ARMILLARY.rest.tilt + field.power * tip * 0.3,
          lean: ARMILLARY.rest.lean - field.power * lean * 0.35,
        };
        const frame = armillary(pose, time / 1000, load);

        frame.rings.forEach((ring, index) => {
          const ellipse = rings[index];
          const fade = fades[index];

          ellipse?.setAttribute('cx', String(ring.cx));
          ellipse?.setAttribute('cy', String(ring.cy));
          ellipse?.setAttribute('rx', String(ring.rx));
          ellipse?.setAttribute('ry', String(ring.ry));
          ellipse?.setAttribute('transform', `rotate(${ring.angle} ${ring.cx} ${ring.cy})`);
          fade?.setAttribute('x1', String(ring.cx));
          fade?.setAttribute('x2', String(ring.cx));
          fade?.setAttribute('y1', String(ring.y1));
          fade?.setAttribute('y2', String(ring.y2));
        });

        frame.requests.forEach((request, index) => {
          const dot = requests[index];

          dot?.setAttribute('cx', String(request.x));
          dot?.setAttribute('cy', String(request.y));
          dot?.setAttribute('r', String(request.r));
          dot?.setAttribute('opacity', String(request.o));
        });

        axis?.setAttribute('x1', String(frame.axis.x1));
        axis?.setAttribute('y1', String(frame.axis.y1));
        axis?.setAttribute('x2', String(frame.axis.x2));
        axis?.setAttribute('y2', String(frame.axis.y2));
        poles[0]?.setAttribute('cx', String(frame.axis.x1));
        poles[0]?.setAttribute('cy', String(frame.axis.y1));
        poles[1]?.setAttribute('cx', String(frame.axis.x2));
        poles[1]?.setAttribute('cy', String(frame.axis.y2));
      };
    },
    { continuous: true }
  );

  return (
    <svg ref={svgRef} viewBox={`0 0 ${ENGINE_WIDTH} ${ENGINE_HEIGHT}`} className="engine-svg">
      <defs>
        {FIRST.rings.map((ring, index) => (
          <linearGradient
            key={index}
            id={`${id}-fade-${index}`}
            data-fade=""
            gradientUnits="userSpaceOnUse"
            x1={ring.cx}
            x2={ring.cx}
            y1={ring.y1}
            y2={ring.y2}
          >
            <stop offset="0" style={{ stopColor: 'var(--engine-accent)', stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: 'var(--engine-accent)', stopOpacity: 0.08 }} />
          </linearGradient>
        ))}
      </defs>
      {/* The sphere's outline: every ring touches it, so they read as one body. */}
      <circle cx={ARMILLARY.center.x} cy={ARMILLARY.center.y} r={ARMILLARY.radius} className="engine-outline" />
      <line
        x1={FIRST.axis.x1}
        y1={FIRST.axis.y1}
        x2={FIRST.axis.x2}
        y2={FIRST.axis.y2}
        className="engine-axis"
      />
      {FIRST.rings.map((ring, index) => (
        <ellipse
          key={index}
          cx={ring.cx}
          cy={ring.cy}
          rx={ring.rx}
          ry={ring.ry}
          transform={`rotate(${ring.angle} ${ring.cx} ${ring.cy})`}
          stroke={`url(#${id}-fade-${index})`}
          className="engine-ring"
        />
      ))}
      {FIRST.requests.map((request, index) => (
        <circle key={index} cx={request.x} cy={request.y} r={request.r} opacity={request.o} className="engine-request" />
      ))}
      <circle cx={FIRST.axis.x1} cy={FIRST.axis.y1} r={2.6} className="engine-pole" />
      <circle cx={FIRST.axis.x2} cy={FIRST.axis.y2} r={2.6} className="engine-pole" />
    </svg>
  );
}
