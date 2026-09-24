import type { CSSProperties } from 'react';
import { ENGINE_HEIGHT, ENGINE_WIDTH, flame, lightning, sphere } from './engine-art';

/*
 * The engines -- the technology we build ourselves (owner's direction,
 * 24 Sep 2026: "here we introduce our in-house engines", in the place of
 * the old action row). Each engine is a Greek name for one job, and each
 * card is the owner's card: navy, one object drawn in light, no blur.
 *
 * The list is data: a new engine is one more entry in ENGINES, and the grid
 * makes room for it. Atlas's name is ours until the owner names it ("another
 * Greek god" for request scaling): the titan who carries the sky, for the
 * engine that carries every request.
 */

type EngineArt = 'lightning' | 'flame' | 'sphere';

type Engine = {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly line: string;
  readonly input: string;
  readonly output: string;
  readonly art: EngineArt;
};

const ENGINES: readonly Engine[] = [
  {
    id: 'zeus',
    name: 'Zeus',
    role: 'Customer memory build',
    line: 'Builds a living memory for every customer from their orders, messages and events, and keeps it current as they happen.',
    input: 'Orders, messages, events',
    output: 'One memory per customer',
    art: 'lightning',
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    role: 'Realtime data processing',
    line: 'Takes every store event the moment it happens and turns it into a signal the agents act on, inside the conversation.',
    input: 'Event streams',
    output: 'Signals, in the moment',
    art: 'flame',
  },
  {
    id: 'atlas',
    name: 'Atlas',
    role: 'Agent request scaling',
    line: 'Carries every agent request, from one store to thousands, and scales with them so no conversation waits.',
    input: 'Agent requests',
    output: 'Replies, at any load',
    art: 'sphere',
  },
];

const BOLT = lightning();
const FIRE = flame();
const GLOBE = sphere();

function Lightning() {
  return (
    <>
      {BOLT.strokes.map((stroke, index) => (
        <path
          key={index}
          d={stroke.d}
          className="engine-bolt"
          style={{
            strokeWidth: Math.max(0.6, 2.4 - stroke.level * 0.3),
            opacity: 1 - (stroke.level - 1) * 0.13,
          }}
        />
      ))}
      {BOLT.tips.map((tip, index) => (
        <circle key={index} cx={tip.x} cy={tip.y} r={1.6} className="engine-spark-dot" />
      ))}
      <circle cx={BOLT.root.x} cy={BOLT.root.y} r={4} className="engine-core" />
    </>
  );
}

function Flame({ id }: { readonly id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-rise`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={ENGINE_HEIGHT} y2={FIRE.top.y}>
          <stop offset="0" style={{ stopColor: 'var(--engine-accent)', stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: 'var(--engine-accent)', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      {FIRE.streams.map((stream, index) => (
        <path key={index} d={stream.d} className="engine-stream" stroke={`url(#${id}-rise)`} />
      ))}
      {/* Sparks travelling up each stream: the data, as it is processed. */}
      {FIRE.streams.map((stream, index) => (
        <path
          key={index}
          d={stream.d}
          pathLength={1}
          className="engine-spark"
          style={{ '--t': stream.t } as CSSProperties}
        />
      ))}
      <circle cx={FIRE.top.x} cy={FIRE.top.y} r={4} className="engine-core" />
    </>
  );
}

function Sphere() {
  const { points, center, radius } = GLOBE;
  const orbit = radius + 28;

  return (
    <>
      {points.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r={point.r} className="engine-point" style={{ opacity: point.o }} />
      ))}
      {/* Requests orbiting the world it carries. The ring is a circle squashed
          into an ellipse, so its dots are drawn tall to come out round. */}
      <g transform={`translate(${center.x} ${center.y}) scale(1 0.28)`}>
        <circle r={orbit} className="engine-ring" />
        <g className="engine-orbit">
          {[0, 72, 144, 216, 288].map(angle => (
            <ellipse
              key={angle}
              // Rounded, like every coordinate here: the server's and the
              // browser's Math.cos can differ in the last digit, and a raw
              // float breaks hydration.
              cx={Math.round(Math.cos((angle * Math.PI) / 180) * orbit * 10) / 10}
              cy={Math.round(Math.sin((angle * Math.PI) / 180) * orbit * 10) / 10}
              rx={3.2}
              ry={3.2 / 0.28}
              className="engine-request"
            />
          ))}
        </g>
      </g>
    </>
  );
}

function Drawing({ engine }: { readonly engine: Engine }) {
  return (
    <svg viewBox={`0 0 ${ENGINE_WIDTH} ${ENGINE_HEIGHT}`} className="engine-svg">
      {engine.art === 'lightning' ? <Lightning /> : null}
      {engine.art === 'flame' ? <Flame id={engine.id} /> : null}
      {engine.art === 'sphere' ? <Sphere /> : null}
    </svg>
  );
}

export function Engines() {
  return (
    <section className="engines" id="engines" aria-labelledby="engines-title">
      <div className="engines-inner">
        <header className="engines-head" data-reveal>
          <p className="engines-eyebrow">Engines · built in-house</p>
          <h2 id="engines-title" className="engines-title">
            The engines under <em>the Agent Store.</em>
          </h2>
          <p className="engines-lede">
            Our own technology, not a wrapper around someone else&apos;s. Each engine does one job, and every agent
            runs on all of them.
          </p>
        </header>

        <ul className="engines-grid">
          {ENGINES.map((engine, index) => (
            <li
              key={engine.id}
              className="engine"
              data-reveal
              style={{ '--reveal-delay': index * 90 } as CSSProperties}
            >
              <figure className="engine-art" aria-hidden="true">
                <Drawing engine={engine} />
              </figure>
              <div className="engine-body">
                <p className="engine-role">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {engine.role}
                </p>
                <h3>{engine.name}</h3>
                <p className="engine-line">{engine.line}</p>
                <dl>
                  <div>
                    <dt>In</dt>
                    <dd>{engine.input}</dd>
                  </div>
                  <div>
                    <dt>Out</dt>
                    <dd>{engine.output}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
