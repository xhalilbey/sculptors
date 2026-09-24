'use client';

import { Building2, CarFront, Droplet, Plane, Plus, Store, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

/*
 * Where the agents sell -- the sectors we support (owner's direction, 24 Sep
 * 2026). It continues the logo strip's dark band, so the brand screen runs
 * on under it; only the card is light, in the page's own cream, with the band
 * under it too. Our own shape, not Databricks' pill
 * tabs: six equal cells in the header's pixel capitals, the chosen one lit,
 * with a lava bar that sits on the card's top edge. Inside the
 * card nothing is boxed: a chart of what the agent moves on the left, a
 * short description on the right, and the description's last rule lands on
 * the chart's baseline. "Others" says the list is not closed: a sector we
 * do not list is composed on request.
 */

type Sector = {
  readonly id: string;
  readonly name: string;
  /** The tab's label: one word or two, so all six cells hold one line. */
  readonly short: string;
  readonly icon: LucideIcon;
  readonly line: string;
  readonly points: readonly string[];
  /** What the chart shows; illustrative. */
  readonly metric: { readonly value: string; readonly label: string; readonly trend: readonly number[] };
};

const SECTORS: readonly Sector[] = [
  {
    id: 'retail',
    name: 'Retail & Ecommerce',
    short: 'Retail',
    icon: Store,
    line: 'From first click to repeat purchase: the agent answers size, stock and delivery in the chat, and closes the order there.',
    points: ['Fit advice from past returns', 'Carts recovered with the product itself', 'Buyers brought back on restock'],
    metric: { value: '+23%', label: 'carts completed', trend: [12, 14, 13, 17, 16, 21, 20, 24, 27, 26, 31, 34] },
  },
  {
    id: 'beauty',
    name: 'Beauty & Cosmetics',
    short: 'Beauty',
    icon: Droplet,
    line: 'Shade matching, routines built from what they already use, and the reorder before the bottle runs out.',
    points: ['Shades and skin types matched', 'Routines from past orders', 'Reorders on time'],
    metric: { value: '2.4x', label: 'repeat orders', trend: [8, 9, 11, 10, 13, 15, 14, 18, 21, 22, 25, 28] },
  },
  {
    id: 'automotive',
    name: 'Automotive',
    short: 'Automotive',
    icon: CarFront,
    line: 'The showroom, open at night: trims and financing compared in the chat, and the test drive booked there.',
    points: ['Test drives booked in the thread', 'Trims and financing compared', 'Follow-up after the visit'],
    metric: { value: '3.1x', label: 'test drives booked', trend: [6, 7, 9, 8, 11, 12, 15, 14, 17, 19, 22, 24] },
  },
  {
    id: 'travel',
    name: 'Travel & Hospitality',
    short: 'Travel',
    icon: Plane,
    line: 'Dates and rooms that fit, the upgrade offered at the right moment, and changes handled without a call.',
    points: ['Availability answered live', 'Upgrades and extras offered', 'Changes without a call center'],
    metric: { value: '+18%', label: 'ancillary revenue', trend: [14, 13, 16, 18, 17, 20, 23, 22, 25, 27, 29, 31] },
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    short: 'Real Estate',
    icon: Building2,
    line: 'Every listing question answered in minutes, buyers qualified by budget and area, and viewings booked into the calendar.',
    points: ['Listings matched to budget and area', 'Leads qualified before the call', 'Viewings booked in the chat'],
    metric: { value: '+36%', label: 'viewings booked', trend: [9, 10, 10, 12, 14, 13, 16, 19, 18, 22, 24, 27] },
  },
];

const CONTACT_URL = 'https://cal.com/halil-eren-pdniuc/30min';
const OTHERS_ID = 'others';

/** The trend as a line and an area under it, in a 600x280 box. */
function chartPaths(values: readonly number[]) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const line = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 600;
      const y = 260 - ((value - min) / span) * 200;

      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return { line, area: `${line} L600 280 L0 280 Z` };
}

export function SectorShowcase() {
  const [activeId, setActiveId] = useState(SECTORS[0]?.id ?? OTHERS_ID);
  const active = SECTORS.find(sector => sector.id === activeId) ?? null;
  const tabs = [...SECTORS.map(sector => ({ id: sector.id, name: sector.short })), { id: OTHERS_ID, name: 'Others' }];

  return (
    <section className="sectors" id="agent-store" aria-labelledby="sectors-title">
      <p className="sectors-eyebrow">Where the agents sell</p>
      <h2 id="sectors-title" className="sectors-title">
        One agent store for
        <br />
        every business that sells
      </h2>

      <div className="sectors-tabs" role="tablist" aria-label="Sectors">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`sector-tab-${tab.id}`}
            aria-selected={tab.id === activeId}
            aria-controls="sector-panel"
            className={tab.id === activeId ? 'is-active' : undefined}
            onClick={() => setActiveId(tab.id)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* keyed so the chart draws again when the sector changes */}
      <div
        className="sectors-panel"
        id="sector-panel"
        role="tabpanel"
        aria-labelledby={`sector-tab-${activeId}`}
        key={activeId}
      >
        {active ? <SectorChart sector={active} /> : <OthersChart />}

        <div className="sectors-copy">
          {active ? (
            <>
              <h3>
                <active.icon aria-hidden="true" />
                {active.name}
              </h3>
              <p>{active.line}</p>
              <ul>
                {active.points.map(point => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3>
                <Plus aria-hidden="true" />
                Your sector
              </h3>
              <p>
                Selling somewhere we have not listed? Every agent is composed from the same primitives, so we build
                one for your business on request.
              </p>
              <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="btn-brand sectors-contact">
                Get in touch
                <span aria-hidden="true">›</span>
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SectorChart({ sector }: { readonly sector: Sector }) {
  const { line, area } = chartPaths(sector.metric.trend);

  return (
    <figure className="sectors-chart">
      <figcaption>
        <strong>{sector.metric.value}</strong>
        <span>{sector.metric.label}, last 12 weeks</span>
        <em>Illustrative</em>
      </figcaption>
      <svg viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`sectors-fill-${sector.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff3621" stopOpacity="0.32" />
            <stop offset="1" stopColor="#ff3621" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[70, 140, 210].map(y => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} className="sectors-grid-line" />
        ))}
        <path d={area} fill={`url(#sectors-fill-${sector.id})`} className="sectors-area" />
        <path d={line} className="sectors-line" pathLength={1} />
      </svg>
    </figure>
  );
}

/** Others: an empty chart waiting for a sector. */
function OthersChart() {
  return (
    <figure className="sectors-chart is-empty">
      <figcaption>
        <strong>+</strong>
        <span>your numbers, once your agent runs</span>
      </figcaption>
      <svg viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true">
        {[70, 140, 210].map(y => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} className="sectors-grid-line" />
        ))}
        <path d="M0 250 L120 236 L240 220 L360 190 L480 160 L600 120" className="sectors-line is-dashed" />
      </svg>
    </figure>
  );
}
