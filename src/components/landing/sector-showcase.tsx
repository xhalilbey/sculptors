'use client';

import { CarFront, DollarSign, Droplet, Plane, Store, Wifi, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

/*
 * Where the agents sell -- the sectors we support (owner's direction, 24 Sep
 * 2026), in Databricks' "Data + AI platform" shape: an eyebrow, a headline,
 * a row of pill tabs, and one wide panel for the chosen tab. It continues
 * the logo strip's dark band, so the brand screen runs on under it.
 *
 * Each sector carries its own short conversation: what an agent actually
 * says in that business, which is the point the panel has to make.
 */

type Sector = {
  readonly id: string;
  readonly name: string;
  readonly icon: LucideIcon;
  readonly line: string;
  readonly outcomes: readonly string[];
  readonly thread: readonly { readonly who: 'shopper' | 'agent'; readonly text: string }[];
};

const SECTORS: readonly Sector[] = [
  {
    id: 'retail',
    name: 'Retail & Ecommerce',
    icon: Store,
    line: 'From first click to repeat purchase, create experiences your customers will love.',
    outcomes: ['Answers size, stock and delivery in the chat', 'Recovers carts with the product itself', 'Brings buyers back when it restocks'],
    thread: [
      { who: 'shopper', text: 'Do you have the black one in 38?' },
      { who: 'agent', text: 'Yes, two left in 38. It runs small, so 38 fits like a 37. Add it?' },
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Cosmetics',
    icon: Droplet,
    line: 'From skincare to self-care, engage customers with personalization, precision and style.',
    outcomes: ['Matches shades and skin types', 'Builds routines from past orders', 'Reorders before the bottle runs out'],
    thread: [
      { who: 'shopper', text: 'Which serum works with oily skin?' },
      { who: 'agent', text: 'The niacinamide one: light, no oils. You bought our cleanser in June, they pair well.' },
    ],
  },
  {
    id: 'finance',
    name: 'Financial Services',
    icon: DollarSign,
    line: 'Build trust and loyalty with personalized experiences that increase engagement and retention.',
    outcomes: ['Explains plans in plain words', 'Qualifies leads before an advisor calls', 'Keeps every answer on the approved script'],
    thread: [
      { who: 'shopper', text: 'What is the difference between the two cards?' },
      { who: 'agent', text: 'Gold has no annual fee in year one and 2x points on travel. Want me to check eligibility?' },
    ],
  },
  {
    id: 'automotive',
    name: 'Automotive',
    icon: CarFront,
    line: 'Connect the digital and showroom experience to accelerate engagement, leads, and retention.',
    outcomes: ['Books test drives from the conversation', 'Compares trims and financing', 'Follows up after the showroom visit'],
    thread: [
      { who: 'shopper', text: 'Can I test drive the hybrid this weekend?' },
      { who: 'agent', text: 'Saturday 11:00 or 14:30 at the Levent showroom. Which one should I hold for you?' },
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Hospitality',
    icon: Plane,
    line: 'Inspire travelers, personalize the journey, boost bookings, and drive ancillary revenue.',
    outcomes: ['Finds dates and rooms that fit', 'Offers upgrades at the right moment', 'Handles changes without a call center'],
    thread: [
      { who: 'shopper', text: 'Is there a sea view room for 12-15 July?' },
      { who: 'agent', text: 'One left, with breakfast. Add airport transfer for 18 EUR and I will book both.' },
    ],
  },
  {
    id: 'telecom',
    name: 'Telecommunications',
    icon: Wifi,
    line: 'Reduce churn, boost loyalty, and personalize for every customer.',
    outcomes: ['Spots customers about to leave', 'Offers the plan that fits their use', 'Solves line issues before a ticket'],
    thread: [
      { who: 'shopper', text: 'My bill went up again this month.' },
      { who: 'agent', text: 'You used 40 GB on a 20 GB plan. The 50 GB plan costs less than this bill. Switch now?' },
    ],
  },
];

export function SectorShowcase() {
  const [activeId, setActiveId] = useState(SECTORS[0]?.id ?? '');
  const active = SECTORS.find(sector => sector.id === activeId) ?? SECTORS[0];

  if (!active) return null;

  const ActiveIcon = active.icon;

  return (
    <section className="sectors" aria-labelledby="sectors-title">
      <p className="sectors-eyebrow">Where the agents sell</p>
      <h2 id="sectors-title" className="sectors-title">
        One agent store for
        <br />
        every business that sells
      </h2>

      <div className="sectors-tabs" role="tablist" aria-label="Sectors">
        {SECTORS.map(sector => (
          <button
            key={sector.id}
            type="button"
            role="tab"
            id={`sector-tab-${sector.id}`}
            aria-selected={sector.id === active.id}
            aria-controls="sector-panel"
            className={sector.id === active.id ? 'is-active' : undefined}
            onClick={() => setActiveId(sector.id)}
          >
            {sector.name}
          </button>
        ))}
      </div>

      <div
        className="sectors-panel"
        id="sector-panel"
        role="tabpanel"
        aria-labelledby={`sector-tab-${active.id}`}
      >
        <div className="sectors-copy">
          <span className="sectors-icon" aria-hidden="true">
            <ActiveIcon />
          </span>
          <h3>{active.name}</h3>
          <p>{active.line}</p>
          <ul>
            {active.outcomes.map(outcome => (
              <li key={outcome}>{outcome}</li>
            ))}
          </ul>
        </div>

        {/* keyed so the thread replays when the sector changes */}
        <div className="sectors-thread" key={active.id} aria-label={`An agent conversation in ${active.name}`}>
          <div className="sectors-thread-bar">
            <span />
            <span />
            <span />
            <em>Sculptors agent</em>
          </div>
          {active.thread.map((message, index) => (
            <p key={index} className={`sectors-bubble is-${message.who}`}>
              {message.text}
            </p>
          ))}
        </div>
      </div>

      <ul className="sectors-grid">
        {SECTORS.map(sector => {
          const SectorIcon = sector.icon;

          return (
            <li key={sector.id}>
              <h4>
                <SectorIcon aria-hidden="true" />
                {sector.name}
              </h4>
              <p>{sector.line}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
