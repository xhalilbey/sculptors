'use client';

import {
  Boxes,
  Braces,
  Check,
  Database,
  LayoutTemplate,
  MessageCircle,
  Plug,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ART_HEIGHT, ART_WIDTH, converge, fanOut, helix } from './journey-art';

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
 *   03 Back to your platform  one agent fanning out to events  what you get
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

/** What comes back to the platform, as the events a developer subscribes to. */
const EVENTS = [
  'order.created',
  'cart.recovered',
  'handoff.requested',
  'review.collected',
  'restock.alerted',
  'memory.updated',
  'attribution.recorded',
];

const CONVERGE = converge(SOURCES);
const HELIX = helix();
const FAN = fanOut(EVENTS);

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

function ConvergeArt() {
  const { agent, lines, labels, exit } = CONVERGE;

  return (
    <figure className="j-art" data-reveal aria-hidden="true">
      <svg viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}>
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
          <path key={index} d={line.d} pathLength={1} className="j-line" stroke="url(#j-converge)" style={stagger(line.t)} />
        ))}
        {lines.map((line, index) => (
          <circle key={index} cx={line.end.x} cy={line.end.y} r={2.2} className="j-dot" style={stagger(line.t)} />
        ))}
        {labels.map(label => (
          <text key={label.text} x={label.at.x} y={label.at.y} dy="0.35em" textAnchor="end" className="j-label">
            {label.text}
          </text>
        ))}
        <path d={exit} pathLength={1} className="j-line is-trunk" stroke="url(#j-converge-exit)" style={stagger(1)} />
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

function HelixArt() {
  const { dots, rungs, period } = HELIX;

  return (
    <figure className="j-art is-helix" data-reveal aria-hidden="true">
      <svg viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}>
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

function FanOutArt() {
  const { order, lines, labels, entry } = FAN;

  return (
    <figure className="j-art is-fan" data-reveal aria-hidden="true">
      <svg viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}>
        <defs>
          <linearGradient id="j-fan" gradientUnits="userSpaceOnUse" x1={order.x} x2="900" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--tone)', stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: 'var(--tone)', stopOpacity: 0.12 }} />
          </linearGradient>
          <linearGradient id="j-fan-entry" gradientUnits="userSpaceOnUse" x1="0" x2={order.x} y1="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--tone)', stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: 'var(--tone)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path d={entry} pathLength={1} className="j-line is-trunk" stroke="url(#j-fan-entry)" style={stagger(0)} />
        {lines.map((line, index) => (
          <path key={index} d={line.d} pathLength={1} className="j-line" stroke="url(#j-fan)" style={stagger(line.t)} />
        ))}
        {lines.map((line, index) => (
          <circle key={index} cx={line.end.x} cy={line.end.y} r={2.2} className="j-dot" style={stagger(line.t)} />
        ))}
        {labels.map(label => (
          <text key={label.text} x={label.at.x} y={label.at.y} dy="0.35em" className="j-label is-code">
            {label.text}
          </text>
        ))}
        <circle cx={order.x} cy={order.y} r={20} className="j-node-ring" />
        <circle cx={order.x} cy={order.y} r={7} className="j-node" />
        <text x={order.x} y={order.y - 34} textAnchor="middle" className="j-label is-strong">
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

const AFTER_FEATURES: ReadonlyArray<{ icon: LucideIcon; text: string }> = [
  { icon: Webhook, text: 'Webhooks for every agent event' },
  { icon: Braces, text: 'Typed SDK and REST API' },
  { icon: LayoutTemplate, text: 'Headless: your UI, our agents' },
  { icon: Boxes, text: 'An isolated store per merchant' },
  { icon: Database, text: 'Memory you can read and write' },
  { icon: ScrollText, text: 'Every conversation logged' },
  { icon: ShieldCheck, text: 'Guardrails you configure' },
  { icon: Target, text: 'Revenue attributed per message' },
]

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

        <div className="j-chapter" id="integrations">
          <ChapterHead
            number="03"
            tag="Back to your platform"
            icon={Webhook}
            title="It doesn't end at checkout:"
            accent="every order, handoff and signal comes back to your platform as an event."
          />
          <FanOutArt />
          <ul className="j-grid">
            {AFTER_FEATURES.map(({ icon: Icon, text }, index) => (
              <li key={text} data-reveal style={{ '--reveal-delay': index * 50 } as CSSProperties}>
                <Icon aria-hidden="true" />
                {text}
              </li>
            ))}
            <li className="j-grid-cta" data-reveal style={{ '--reveal-delay': 400 } as CSSProperties}>
              <Link href="/auth/login">
                Get started
                <span aria-hidden="true">↗</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
