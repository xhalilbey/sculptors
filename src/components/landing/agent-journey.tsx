'use client';

import { Check, MessageCircle, Plug, Sparkles, Webhook, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ART_HEIGHT, ART_WIDTH, converge, helix, rails, seeded } from './journey-art';
import { pushed, type Reach } from './pointer-field';
import { dotPainter, strandPainter, usePointerField } from './use-pointer-field';

/*
 * How the agent sells, told as one journey (owner's direction, 24 Sep 2026:
 * "our content after the sectors is weak -- look at how caretta.so explains
 * its product with graphics"). It replaces three sections that each made a
 * separate point (the agent's cards, the store's parts, the action row).
 *
 * Told from where our customers stand (owner's direction, same day: "we
 * serve developers now -- they integrate the Agent Store into their
 * platforms"), and in our palette only: lava for the accent, navy for ink.
 * Three chapters, each with a headline whose second half carries the
 * accent, a drawing that pictures the step, and the surfaces underneath,
 * drawn in HTML so the text is text:
 *
 *   01 Integrate            your platform's data flowing in   SDK, sync, compose
 *   02 In your product      shopper and agent, one helix      the thread + CTA
 *   03 Back to your platform  events running home on rails    the event catalog
 *                                                             and a handler
 *
 * The drawings answer the pointer as caretta.so's do (owner's direction,
 * 25 Sep 2026: "I should feel them when I hover"; pointer-field.ts): lines
 * part around the hand and settle when it stops. Pulses run along them --
 * data into the store, events home to the platform.
 *
 * The owner liked chapter 02 as it was and asked for only its colours and
 * its call to action to change; its helix, chips and headline are as
 * first drawn. The code in chapter 01 is illustrative, until the SDK's
 * real names are settled.
 *
 * The chapters sit in a framed 1200px column ruled with hairlines, and an
 * index in the pixel face rides the left gutter on wide screens.
 */

/** What a platform already has, flowing into the Agent Store. */
const SOURCES = ['Catalog', 'Customers', 'Orders', 'Inventory', 'Events', 'Rules', 'Channels'];

/**
 * What comes back to the platform: the events a developer subscribes to,
 * what each one means, what it carries, and -- for the drawing only -- how
 * often it fires, in seconds.
 */
const EVENTS = [
  { name: 'order.created', copy: 'The agent closed a sale in the thread.', carries: 'order · items · attribution', every: 3.4 },
  { name: 'cart.recovered', copy: 'A cart came back, with the message that brought it.', carries: 'cart · message', every: 5.8 },
  { name: 'handoff.requested', copy: 'A person is needed, and gets the whole conversation.', carries: 'conversation · reason', every: 7.4 },
  { name: 'memory.updated', copy: 'The agent learned something about a customer.', carries: 'customer · facts', every: 2.6 },
  { name: 'review.collected', copy: 'A review asked for after delivery, and given.', carries: 'order · rating · text', every: 6.6 },
  { name: 'restock.alerted', copy: 'A buyer told the moment their size is back.', carries: 'product · customer', every: 8.4 },
  { name: 'attribution.recorded', copy: 'Revenue tied to the message that earned it.', carries: 'message · revenue', every: 4.6 },
] as const;

type EventName = (typeof EVENTS)[number]['name'];

const CONVERGE = converge(SOURCES);
const HELIX = helix();
const RAILS = rails(EVENTS.map(event => event.name));

/** The journey's drawings are 1200 wide: the pointer reaches about a seventh of it. */
const REACH: Reach = { radius: 170, push: 34 };
/** The helix's dots are small and close: a tighter reach. */
const HELIX_REACH: Reach = { radius: 140, push: 28 };

/** A phase into a pulse's cycle, in seconds, drawn from `random`. */
const phase = (random: () => number, cycle: number) => `${Math.round(random() * cycle * 10) / 10}s`;

const INDEX = [
  { id: 'agent-store', label: 'Sectors' },
  { id: 'memory', label: 'Integrate' },
  { id: 'agent', label: 'In product' },
  { id: 'integrations', label: 'Events' },
  { id: 'engines', label: 'Engines' },
  { id: 'faq', label: 'FAQ' },
] as const;

const DEMO_URL = 'https://cal.com/halil-eren-pdniuc/30min';

/* ---- the index --------------------------------------------------------- */

/** Which chapter holds the reading line (45% down the viewport), if any. */
function useActiveChapter(): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.45;
      const current = INDEX.find(item => {
        const rect = document.getElementById(item.id)?.getBoundingClientRect();

        return rect ? rect.top <= line && rect.bottom > line : false;
      });

      setActive(current?.id ?? null);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return active;
}

function JourneyIndex() {
  const active = useActiveChapter();

  return (
    <nav
      className={['j-index', active ? 'is-shown' : '', active === 'agent-store' ? 'is-on-band' : ''].join(' ').trim()}
      aria-label="On this page"
    >
      {INDEX.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={item.id === active ? 'is-active' : undefined}
          aria-current={item.id === active ? 'true' : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

/* ---- chapter heads ----------------------------------------------------- */

function ChapterHead({
  number,
  tag,
  icon: Icon,
  title,
  accent,
}: {
  readonly number: string;
  readonly tag: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly accent: string;
}) {
  return (
    <header className="j-head" data-reveal>
      <p className="j-tag">
        <span>{number}</span>
        <Icon aria-hidden="true" />
        {tag}
      </p>
      <h2 className="j-title">
        {title} <em>{accent}</em>
      </h2>
    </header>
  );
}

/* ---- the drawings ------------------------------------------------------ */

const stagger = (t: number): CSSProperties => ({ '--t': t }) as CSSProperties;

/** Pulses ride one line in three, each on its own beat. */
const CONVERGE_PULSES = (() => {
  const random = seeded(23);

  random(); // a small seed's first draw is always near 0

  return new Map(
    CONVERGE.lines.flatMap((_, index) => (index % 3 === 1 ? [[index, phase(random, 4.2)] as const] : []))
  );
})();

function ConvergeArt() {
  const { agent, lines, labels, exit } = CONVERGE;
  const svgRef = useRef<SVGSVGElement>(null);

  usePointerField(svgRef, svg => {
    const strands = strandPainter(svg, 'source', lines, REACH);
    const trunk = strandPainter(svg, 'exit', [exit], REACH);
    // Each source dot rides the loose end of its line.
    const dots = dotPainter(svg, 'source', lines.map(line => line.end), REACH);

    return field => {
      strands(field);
      trunk(field);
      dots(field);
    };
  });

  return (
    <figure className="j-art" data-reveal aria-hidden="true">
      <svg ref={svgRef} viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}>
        <defs>
          <linearGradient id="j-converge" gradientUnits="userSpaceOnUse" x1="190" x2={agent.x} y1="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--tone)', stopOpacity: 0.08 }} />
            <stop offset="1" style={{ stopColor: 'var(--tone)', stopOpacity: 0.95 }} />
          </linearGradient>
          <linearGradient id="j-converge-exit" gradientUnits="userSpaceOnUse" x1={agent.x} x2={ART_WIDTH} y1="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--tone)', stopOpacity: 1 }} />
            <stop offset="1" style={{ stopColor: 'var(--tone)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {lines.map((line, index) => (
          <path
            key={index}
            d={line.d}
            pathLength={1}
            data-strand={`source-${index}`}
            className="j-line"
            stroke="url(#j-converge)"
            style={stagger(line.t)}
          />
        ))}
        {/* The data on its way in: a pulse from a source to the store. */}
        {lines.map((line, index) =>
          CONVERGE_PULSES.has(index) ? (
            <path
              key={index}
              d={line.d}
              pathLength={1}
              data-strand={`source-${index}`}
              className="j-pulse"
              style={{ '--phase': CONVERGE_PULSES.get(index) } as CSSProperties}
            />
          ) : null
        )}
        {lines.map((line, index) => (
          <circle
            key={index}
            cx={line.end.x}
            cy={line.end.y}
            r={2.2}
            data-dot={`source-${index}`}
            className="j-dot"
            style={stagger(line.t)}
          />
        ))}
        {labels.map(label => (
          <text key={label.text} x={label.at.x} y={label.at.y} dy="0.35em" textAnchor="end" className="j-label">
            {label.text}
          </text>
        ))}
        <path
          d={exit.d}
          pathLength={1}
          data-strand="exit-0"
          className="j-line is-trunk"
          stroke="url(#j-converge-exit)"
          style={stagger(1)}
        />
        <circle cx={agent.x} cy={agent.y} r={20} className="j-node-ring" />
        <circle cx={agent.x} cy={agent.y} r={7} className="j-node" />
        <text x={agent.x} y={agent.y - 34} textAnchor="middle" className="j-label is-strong">
          Agent Store
        </text>
      </svg>
    </figure>
  );
}

const THREAD_CHIPS = [
  { who: 'shopper', text: 'Do you have the black one in 38?', left: 6, top: 12 },
  { who: 'agent', text: 'Yes · 2 left · runs a size small', left: 30, top: 70 },
  { who: 'shopper', text: 'Perfect, add it', left: 56, top: 14 },
  { who: 'agent', text: 'Order #1042 placed', left: 76, top: 68 },
] as const;

/** The helix's dots, displaced this frame, and whether they are off rest. */
function helixPainter(svg: SVGSVGElement) {
  const track = svg.querySelector<SVGGElement>('.j-helix-track');
  const dots = [...svg.querySelectorAll<SVGCircleElement>('.j-strand')];
  const rungs = [...svg.querySelectorAll<SVGLineElement>('.j-rung')];
  const at = HELIX.dots.map(dot => [dot.x, dot.y]);
  const moved = HELIX.dots.map(() => false);
  const rungMoved = HELIX.rungs.map(() => false);
  const r1 = (n: number) => String(Math.round(n * 10) / 10);

  return (field: { x: number; y: number; power: number }) => {
    // The track slides one period in its CSS animation's time; the pointer
    // is met in the track's own units, where the dots are.
    const slide = track?.getAnimations()[0];
    const duration = Number(slide?.effect?.getTiming().duration) || 16000;
    const offset = slide ? ((Number(slide.currentTime ?? 0) % duration) / duration) * HELIX.period : 0;
    const local = { x: field.x + offset, y: field.y, power: field.power };

    HELIX.dots.forEach((dot, index) => {
      const [x, y] = pushed(dot.x, dot.y, 1, local, HELIX_REACH);
      const shifted = x !== dot.x || y !== dot.y;

      at[index] = [x, y];

      if (shifted || moved[index]) {
        dots[index]?.setAttribute('cx', r1(x));
        dots[index]?.setAttribute('cy', r1(y));
        moved[index] = shifted;
      }
    });

    // A rung holds the two dots at its x, wherever they have been pushed.
    HELIX.rungs.forEach((rung, index) => {
      const shifted = (moved[rung.a] ?? false) || (moved[rung.b] ?? false);

      if (!shifted && !rungMoved[index]) {
        return;
      }

      const [x1, y1] = at[rung.a] ?? [rung.x, rung.y1];
      const [x2, y2] = at[rung.b] ?? [rung.x, rung.y2];

      rungs[index]?.setAttribute('x1', r1(x1 ?? rung.x));
      rungs[index]?.setAttribute('y1', r1(y1 ?? rung.y1));
      rungs[index]?.setAttribute('x2', r1(x2 ?? rung.x));
      rungs[index]?.setAttribute('y2', r1(y2 ?? rung.y2));
      rungMoved[index] = shifted;
    });
  };
}

function HelixArt() {
  const { dots, rungs, period } = HELIX;
  const svgRef = useRef<SVGSVGElement>(null);

  usePointerField(svgRef, helixPainter);

  return (
    <figure className="j-art is-helix" data-reveal aria-hidden="true">
      <svg ref={svgRef} viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}>
        <g className="j-helix-track" style={{ '--period': `${period}px` } as CSSProperties}>
          {rungs.map((rung, index) => (
            <line key={index} x1={rung.x} x2={rung.x} y1={rung.y1} y2={rung.y2} className="j-rung" style={{ opacity: rung.o }} />
          ))}
          {dots.map((dot, index) => (
            <circle
              key={index}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              className={dot.strand === 'agent' ? 'j-strand is-agent' : 'j-strand'}
              style={{ opacity: dot.o }}
            />
          ))}
        </g>
      </svg>
      {THREAD_CHIPS.map(chip => (
        <span
          key={chip.text}
          className={`j-chip is-${chip.who}`}
          style={{ left: `${chip.left}%`, top: `${chip.top}%` }}
        >
          {chip.who === 'agent' ? <Sparkles aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
          {chip.text}
        </span>
      ))}
    </figure>
  );
}

/** Each rail's packet: its cycle is how often its event fires, its phase where it starts. */
const RAIL_BEATS = (() => {
  const random = seeded(31);

  random(); // a small seed's first draw is always near 0

  return EVENTS.map(event => ({ '--every': `${event.every}s`, '--phase': phase(random, event.every) }) as CSSProperties);
})();

function RailsArt({ lit }: { readonly lit: EventName | null }) {
  const { agent, platform, rails: routes, entry } = RAILS;
  const svgRef = useRef<SVGSVGElement>(null);

  usePointerField(svgRef, svg => {
    const lines = strandPainter(svg, 'rail', routes, REACH);
    const trunk = strandPainter(svg, 'entry', [entry], REACH);

    return field => {
      lines(field);
      trunk(field);
    };
  });

  return (
    <figure className={lit ? 'j-art is-rails has-lit' : 'j-art is-rails'} data-reveal aria-hidden="true">
      <svg ref={svgRef} viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}>
        <defs>
          <linearGradient id="j-rails-entry" gradientUnits="userSpaceOnUse" x1="0" x2={agent.x} y1="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--tone)', stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: 'var(--tone)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path
          d={entry.d}
          pathLength={1}
          data-strand="entry-0"
          className="j-line is-trunk"
          stroke="url(#j-rails-entry)"
          style={stagger(0)}
        />
        <line x1={platform.x} x2={platform.x} y1={platform.top} y2={platform.bottom} className="j-platform" />
        <text x={platform.x} y={platform.top - 12} textAnchor="middle" className="j-label is-strong">
          Your platform
        </text>
        {routes.map((route, index) => {
          const name = EVENTS[index]?.name;

          return (
            <g key={route.label.text} className={name === lit ? 'j-route is-lit' : 'j-route'} style={RAIL_BEATS[index]}>
              <path
                d={route.d}
                pathLength={1}
                data-strand={`rail-${index}`}
                className="j-line j-rail"
                style={stagger(route.t)}
              />
              <path d={route.d} pathLength={1} data-strand={`rail-${index}`} className="j-packet" />
              <rect x={route.port.x - 4} y={route.port.y - 4} width={8} height={8} className="j-port" />
              <text x={route.label.at.x} y={route.label.at.y} dy="0.35em" className="j-label is-code j-port-label">
                {route.label.text}
              </text>
            </g>
          );
        })}
        <circle cx={agent.x} cy={agent.y} r={20} className="j-node-ring" />
        <circle cx={agent.x} cy={agent.y} r={7} className="j-node" />
        <text x={agent.x} y={agent.y - 34} textAnchor="middle" className="j-label is-strong">
          Your agent
        </text>
      </svg>
    </figure>
  );
}

/* ---- the product's surfaces ------------------------------------------- */

function Cell({
  title,
  copy,
  delay,
  children,
}: {
  readonly title: string;
  readonly copy: string;
  readonly delay: number;
  readonly children: ReactNode;
}) {
  return (
    <article className="j-cell" data-reveal style={{ '--reveal-delay': delay } as CSSProperties}>
      <div className="j-cell-stage">{children}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

/** A code card: lines of tokens, each token a [kind, text] pair. */
type Token = readonly ['k' | 's' | 'f' | 'p' | 'c' | 't', string];

function Code({ file, lines, foot }: { readonly file: string; readonly lines: readonly (readonly Token[])[]; readonly foot?: string }) {
  return (
    <div className="j-code">
      <div className="j-code-bar">
        <span />
        <span />
        <span />
        <em>{file}</em>
      </div>
      <pre>
        <code>
          {lines.map((line, index) => (
            <span key={index} className="j-code-line">
              {line.map(([kind, text], at) => (
                <span key={at} className={`is-${kind}`}>
                  {text}
                </span>
              ))}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
      {foot ? (
        <p className="j-code-foot">
          <Check aria-hidden="true" />
          {foot}
        </p>
      ) : null}
    </div>
  );
}

const INSTALL: readonly (readonly Token[])[] = [
  [['c', '// one package, typed end to end']],
  [['k', 'import'], ['p', ' { AgentStore } '], ['k', 'from'], ['s', " 'sculptors'"]],
  [],
  [['k', 'const'], ['p', ' store = '], ['k', 'new'], ['f', ' AgentStore'], ['p', '({']],
  [['p', '  apiKey: '], ['t', 'env'], ['p', '.SCULPTORS_KEY,']],
  [['p', '  tenant: '], ['t', 'merchant'], ['p', '.id,']],
  [['p', '})']],
];

const SYNC: readonly (readonly Token[])[] = [
  [['c', '// your data becomes its memory']],
  [['k', 'await'], ['p', ' store.memory.'], ['f', 'sync'], ['p', '({']],
  [['p', '  catalog: '], ['t', 'platform'], ['p', '.products,']],
  [['p', '  customers: '], ['t', 'platform'], ['p', '.users,']],
  [['p', '  orders: '], ['t', 'platform'], ['p', '.orders,']],
  [['p', '})']],
];

const COMPOSE: readonly (readonly Token[])[] = [
  [['c', '// every piece is a primitive']],
  [['k', 'await'], ['p', ' store.agents.'], ['f', 'create'], ['p', '({']],
  [['p', '  role: '], ['s', "'sales'"], ['p', ',']],
  [['p', '  memory: ['], ['s', "'catalog'"], ['p', ', '], ['s', "'customers'"], ['p', '],']],
  [['p', '  channels: ['], ['s', "'web'"], ['p', ', '], ['s', "'whatsapp'"], ['p', '],']],
  [['p', '  rules: ['], ['s', "'no-date-without-stock'"], ['p', '],']],
  [['p', '})']],
];

const DURING_STEPS = [
  { title: 'Agents that close the sale', copy: 'The answer, the product and the order, in one thread.' },
  { title: 'Your UI, your brand', copy: 'Drop in our components, or build your own on the API.' },
  { title: 'Every channel you support', copy: 'Web chat, WhatsApp, Instagram and SMS, one agent.' },
  { title: 'A person when it matters', copy: 'Handoff to your team, with the whole context.' },
];

function Thread() {
  return (
    <div className="j-chat" data-reveal style={{ '--reveal-delay': 120 } as CSSProperties}>
      <div className="j-chat-head">
        <span className="j-avatar is-small">AY</span>
        <div>
          <strong>Ayşe Y.</strong>
          <span>Instagram · DM</span>
        </div>
        <em>
          <i aria-hidden="true" />
          Agent replying
        </em>
      </div>
      <div className="j-chat-body">
        <p className="j-msg is-shopper">Hi! Do you have the black blazer in 38?</p>
        <p className="j-msg is-agent">
          Hi Ayşe — yes, 2 left in 38. It runs a size small, so 38 fits like the 37 you kept last time.
        </p>
        <div className="j-msg is-card">
          <span className="j-thumb" aria-hidden="true" />
          <div>
            <strong>Oversize Blazer · Black</strong>
            <span>Size 38 · $129</span>
          </div>
          <b>Add to cart</b>
        </div>
        <p className="j-msg is-shopper">Perfect, add it.</p>
        <p className="j-msg is-system">
          <Check aria-hidden="true" />
          Order #1042 placed · $129 · arrives Thursday
        </p>
      </div>
    </div>
  );
}

const HANDLER: readonly (readonly Token[])[] = [
  [['c', '// every event arrives typed and signed']],
  [['p', 'store.webhooks.'], ['f', 'on'], ['p', '('], ['s', "'order.created'"], ['p', ', '], ['k', 'async'], ['t', ' event'], ['p', ' => {']],
  [['k', '  await'], ['p', ' platform.orders.'], ['f', 'upsert'], ['p', '('], ['t', 'event'], ['p', '.order)']],
  [['k', '  await'], ['p', ' platform.revenue.'], ['f', 'attribute'], ['p', '({']],
  [['p', '    message: '], ['t', 'event'], ['p', '.attribution.messageId,']],
  [['p', '    amount: '], ['t', 'event'], ['p', '.order.total,']],
  [['p', '  })']],
  [['p', '})']],
];

/**
 * Chapter three: the rails, the events they carry, and the code that takes
 * them in. Pointing at an event lights its rail in the drawing, and dims
 * the others, as Caretta's lists do.
 */
function PlatformChapter() {
  const [lit, setLit] = useState<EventName | null>(null);

  return (
    <div className="j-chapter" id="integrations">
      <ChapterHead
        number="03"
        tag="Back to your platform"
        icon={Webhook}
        title="Your platform stays the source of truth:"
        accent="every sale, handoff and memory change comes back to it as a typed, signed event."
      />
      <RailsArt lit={lit} />
      <div className="j-after">
        <ul className={lit ? 'j-events has-lit' : 'j-events'} onPointerLeave={() => setLit(null)}>
          {EVENTS.map((event, index) => (
            <li
              key={event.name}
              className={event.name === lit ? 'is-lit' : undefined}
              data-reveal
              style={{ '--reveal-delay': index * 50 } as CSSProperties}
              onPointerEnter={() => setLit(event.name)}
            >
              <code>{event.name}</code>
              <div>
                <p>{event.copy}</p>
                <span>{event.carries}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="j-after-code" data-reveal style={{ '--reveal-delay': 120 } as CSSProperties}>
          <Code file="webhooks.ts" lines={HANDLER} foot="Signed · retried · replayable" />
          <div className="j-after-cta">
            <Link href="/auth/login" className="btn-brand">
              Get your API key
              <span aria-hidden="true">›</span>
            </Link>
            <a href={DEMO_URL} target="_blank" rel="noopener noreferrer">
              Book a demo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- the section ------------------------------------------------------- */

export function AgentJourney() {
  return (
    <section className="journey" id="platform" aria-label="How the agent sells">
      <JourneyIndex />

      <div className="journey-frame">
        <div className="j-chapter" id="memory">
          <ChapterHead
            number="01"
            tag="Integrate"
            icon={Plug}
            title="Integrate once:"
            accent="connect your platform's catalog, customers and orders, and the Agent Store builds its memory from them."
          />
          <ConvergeArt />
          <div className="j-cells">
            <Cell
              title="Install the Agent Store"
              copy="One typed package. Every merchant on your platform gets an isolated store under your key."
              delay={0}
            >
              <Code file="setup.ts" lines={INSTALL} />
            </Cell>
            <Cell
              title="Sync what you already have"
              copy="Products, customers and orders become the agents' memory, and stay current as your platform changes."
              delay={90}
            >
              <Code file="sync.ts" lines={SYNC} foot="12,480 products · 38,211 customers" />
            </Cell>
            <Cell
              title="Compose the agent"
              copy="Memory, channels, skills and rules are primitives. How your agents sell is yours to decide."
              delay={180}
            >
              <Code file="agent.ts" lines={COMPOSE} />
            </Cell>
          </div>
        </div>

        <div className="j-chapter" id="agent">
          <ChapterHead
            number="02"
            tag="In your product"
            icon={MessageCircle}
            title="Win the moment in the thread:"
            accent="the answer, the product and the order, without a link out."
          />
          <HelixArt />
          <div className="j-during">
            <ol className="j-steps" data-reveal>
              {DURING_STEPS.map((step, index) => (
                <li key={step.title} className={index === 0 ? 'is-active' : undefined}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.copy}</p>
                  </div>
                </li>
              ))}
              {/* The call to action says what the Agent Store is for. */}
              <li className="j-steps-cta">
                <strong>Give every merchant on your platform an agent that sells.</strong>
                <p>Integrate the Agent Store in an afternoon and ship it under your own brand.</p>
                <div>
                  <Link href="/auth/login" className="btn-brand">
                    Integrate the Agent Store
                    <span aria-hidden="true">›</span>
                  </Link>
                  <a href={DEMO_URL} target="_blank" rel="noopener noreferrer">
                    Book a demo
                  </a>
                </div>
              </li>
            </ol>
            <Thread />
          </div>
        </div>

        <PlatformChapter />
      </div>
    </section>
  );
}
