import { Instrument_Serif } from 'next/font/google';
import Image from 'next/image';
import type { CSSProperties } from 'react';

/**
 * "Parts of the Agent Store": four blue cards, each showing its part as a
 * flat illustration of the thing itself rather than an abstract instrument.
 *
 * The illustrations are generated (fal, nano-banana-pro) on the card's own
 * blue, so each one reads as a panel inset in the card rather than a picture
 * pasted onto it. They carry no type on purpose -- generated lettering is
 * never real words, and the card already says what it is in its heading.
 *
 * They replaced two earlier passes: line work in Bending Spoons' technique on
 * black, and then hand-drawn flat objects on a light panel. The first was
 * right for a page selling instruments; the second put a grey slab in the
 * middle of every card.
 *
 * Each panel is rounded at the top and runs past the card's foot, so the card
 * crops it. That is the one habit worth keeping from the first pass: an
 * object that ends inside the frame reads as a picture, one that runs past it
 * reads as a surface the card is a window onto.
 */
const serif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
});

type Part = {
  readonly name: string;
  readonly tagline: string;
  /** Under /public/store, generated at 16:9 and served at 1376 wide (2x). */
  readonly art: string;
};

const PARTS: readonly Part[] = [
  {
    name: 'Product Memory',
    tagline: 'Every product, campaign and creative, remembered with its numbers.',
    art: '/store/product-memory.webp',
  },
  {
    name: 'Customer Memory',
    tagline: 'One memory per customer: what they bought, asked and answered.',
    art: '/store/customer-memory.webp',
  },
  {
    name: 'Agent Design',
    tagline: 'Compose the agents that sell, from what the two memories know.',
    art: '/store/agent-design.webp',
  },
  {
    name: 'Integrations',
    tagline: 'Meta, Google, Shopify, WhatsApp, Instagram, SMS. Every channel in, every action out.',
    art: '/store/integrations.webp',
  },
];

export function AgentStoreParts() {
  return (
    <section
      id="platform"
      className={`store-parts ${serif.variable}`}
      aria-labelledby="store-parts-title"
    >
      <div className="store-parts-inner">
        <header className="store-parts-head" data-reveal="">
          <p className="store-parts-eyebrow">AGENT STORE</p>
          <h2 id="store-parts-title">Parts of the Agent Store</h2>
          <p className="store-parts-lede">
            Four parts every store runs on: two memories, the agents built from them, and the
            channels they reach.
          </p>
        </header>

        <ul className="store-parts-grid">
          {PARTS.map((part, index) => (
            <li
              key={part.name}
              className="store-part"
              data-reveal=""
              style={{ '--reveal-delay': index * 110 } as CSSProperties}
            >
              <h3>{part.name}</h3>
              <p>{part.tagline}</p>
              <div className="store-part-visual" aria-hidden="true">
                <Image
                  src={part.art}
                  alt=""
                  width={1376}
                  height={768}
                  sizes="(max-width: 900px) 92vw, 46vw"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
