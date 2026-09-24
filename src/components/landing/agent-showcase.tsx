import { Instrument_Serif } from 'next/font/google';
import type { CSSProperties } from 'react';

/*
 * The heading face, loaded here as well as in the parts band: --font-instrument-serif
 * is scoped to the element carrying the variable, so a font-family that names it
 * from another section resolves to nothing and the heading silently stays sans.
 */
const serif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
});

/**
 * "Meet the agent": the white band above the store's parts, built the way
 * Modal builds its Workloads row -- a stage per card carrying a mockup of
 * the product, then a title and a line under it.
 *
 * The stages are coded, not generated or photographed. Every one of them is
 * a real interface rendered in HTML: the text is text, the numbers are
 * numbers, and the whole thing stays crisp at any density instead of being
 * a picture of a screen. It is also the only way each stage can move --
 * a reply types itself, a product rises into the thread, a figure climbs --
 * which a still image cannot do.
 *
 * All motion is CSS (`.showcase *` in globals.css), and every animated
 * element rests on its finished state, so reduced motion gets the three
 * mockups fully drawn and nothing animates.
 */

type Card = {
  readonly title: string;
  readonly copy: string;
  readonly stage: 'thread' | 'product' | 'campaign';
};

const CARDS: readonly Card[] = [
  {
    title: 'It knows who is asking',
    copy: 'Every message arrives with the customer behind it: what they bought, what they asked, what they never came back for.',
    stage: 'thread',
  },
  {
    title: 'It opens the right product',
    copy: 'The agent answers with the product itself, in the conversation, at the size and colour that customer actually buys.',
    stage: 'product',
  },
  {
    title: 'It follows the money',
    copy: 'Every creative, audience and campaign is read daily, so what works is scaled and what does not is stopped.',
    stage: 'campaign',
  },
];

/* ---- stage one: the thread ------------------------------------------ */

function Thread() {
  return (
    <div className="stage stage-thread">
      <div className="stage-bar">
        <span className="stage-dot" />
        <span className="stage-dot" />
        <span className="stage-dot" />
        <span className="stage-title">WhatsApp · Ayşe Y.</span>
      </div>

      <div className="stage-body">
        <p className="bubble bubble-them">Siyahı 38 beden var mı?</p>

        <p className="recall">
          <span className="recall-dot" />2 orders · size 38 · 14 days ago
        </p>

        <p className="bubble bubble-us">
          <span className="typing">Var, sizin bedeninizden ayırdım.</span>
        </p>
      </div>
    </div>
  );
}

/* ---- stage two: the product ------------------------------------------ */

function Product() {
  return (
    <div className="stage stage-product">
      <div className="stage-bar">
        <span className="stage-dot" />
        <span className="stage-dot" />
        <span className="stage-dot" />
        <span className="stage-title">Instagram · DM</span>
      </div>

      <div className="stage-body">
        <p className="bubble bubble-them">Fiyatı ne kadar?</p>

        <div className="product-card">
          <div className="product-thumb" aria-hidden="true">
            <span className="product-swatch" />
          </div>
          <div className="product-meta">
            <span className="product-name">Oversize Ceket</span>
            <span className="product-price">2.490 TL</span>
            <span className="product-stock">In stock · 38</span>
          </div>
          <span className="product-cta">Sepete ekle</span>
        </div>
      </div>
    </div>
  );
}

/* ---- stage three: the campaign --------------------------------------- */

const BARS = [
  { label: 'Creative 01', value: 34, lit: false },
  { label: 'Creative 02', value: 96, lit: true },
  { label: 'Creative 03', value: 52, lit: false },
  { label: 'Creative 04', value: 21, lit: false },
];

function Campaign() {
  return (
    <div className="stage stage-campaign">
      <div className="stage-bar">
        <span className="stage-dot" />
        <span className="stage-dot" />
        <span className="stage-dot" />
        <span className="stage-title">Meta Ads · ROAS</span>
      </div>

      <div className="stage-body">
        {BARS.map((bar, i) => (
          <div key={bar.label} className="bar-row">
            <span className="bar-label">{bar.label}</span>
            <span className="bar-track">
              <span
                className={`bar-fill ${bar.lit ? 'is-lit' : ''}`}
                style={{ '--to': `${bar.value}%`, animationDelay: `${i * 0.18}s` } as CSSProperties}
              />
            </span>
            <span className={`bar-value ${bar.lit ? 'is-lit' : ''}`}>
              {(bar.value / 24).toFixed(2)}x
            </span>
          </div>
        ))}

        <p className="campaign-note">
          <span className="recall-dot" />
          Scaling B · pausing D
        </p>
      </div>
    </div>
  );
}

const STAGES: Record<Card['stage'], () => React.JSX.Element> = {
  thread: Thread,
  product: Product,
  campaign: Campaign,
};

export function AgentShowcase() {
  return (
    <section id="agent" className={`showcase ${serif.variable}`} aria-labelledby="showcase-title">
      <div className="showcase-inner">
        <header className="showcase-head" data-reveal="">
          <p className="showcase-eyebrow">THE AGENT</p>
          <h2 id="showcase-title">An agent that sells, not a storefront that waits.</h2>
        </header>

        <ul className="showcase-grid">
          {CARDS.map((card, index) => {
            const Stage = STAGES[card.stage];

            return (
              <li
                key={card.title}
                className="showcase-card"
                data-reveal=""
                style={{ '--reveal-delay': index * 110 } as CSSProperties}
              >
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
                <div className="showcase-stage" aria-hidden="true">
                  <Stage />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
