import {
  CalendarDays,
  ChevronDown,
  ChevronsUpDown,
  CircleDollarSign,
  LayoutGrid,
  Megaphone,
  Receipt,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { SculptorsMark } from '@/components/brand/sculptors-mark';
import { layoutJourney, type JourneySource } from '@/components/landing/journey-flow';
import { NAVIGATION_GROUPS } from '@/config/constants';

/**
 * The product, laid on the page at an angle -- HockeyStack's hero, where the
 * dashboard is a sheet lying back on the white and fading into it rather
 * than a window standing in a frame (owner's direction, 24 Sep 2026; it
 * stood upright on a painted band before).
 *
 * The sheet is drawn flat at a fixed design size (.iso-dash, 1500x940) and
 * the stylesheet does the rest: it tips it back, turns it, scales it to the
 * page's width and fades its far edge. Nothing in here knows it is tilted.
 *
 * The rail reads NAVIGATION_GROUPS and every entry is a real Link, so the
 * pages a visitor sees are the pages the app has. The figures are
 * illustrative and the header says so ("Demo data").
 */

const KPIS = [
  {
    icon: CircleDollarSign,
    label: 'Revenue',
    value: '$1.28M',
    note: '+18% vs. $1.08M last month',
  },
  {
    icon: ShoppingBag,
    label: 'Purchases',
    value: '8,420',
    note: '+31% vs. 6,430 last month',
  },
  {
    icon: Receipt,
    label: 'Avg. order value',
    value: '$152.40',
    note: '-4% vs. $158.70 last month',
  },
  {
    icon: Users,
    label: 'Engaged users',
    value: '42.1K',
    note: '+12% vs. 37.6K last month',
  },
] as const;

/** Where the agents' conversations start, and how many of them end in a sale. */
const CHANNELS: readonly JourneySource[] = [
  { name: 'Instagram', conversations: 2450, purchaseRate: 0.72 },
  { name: 'WhatsApp', conversations: 2035, purchaseRate: 0.68 },
  { name: 'TikTok Shop', conversations: 1670, purchaseRate: 0.61 },
  { name: 'Web chat', conversations: 1485, purchaseRate: 0.66 },
  { name: 'SMS', conversations: 1113, purchaseRate: 0.58 },
  { name: 'Email', conversations: 820, purchaseRate: 0.55 },
];

/** The journey's drawing box, in the SVG's own units. */
const FLOW = { width: 760, height: 318, labelWidth: 150, outcomeWidth: 96, bar: 8 };
const JOURNEY = layoutJourney(CHANNELS, {
  sourceX: FLOW.labelWidth + FLOW.bar,
  targetX: FLOW.width - FLOW.outcomeWidth,
  top: 6,
  height: FLOW.height - 12,
  sourceGap: 9,
  targetGap: 18,
});

/** Orders the agents closed, by month. Older months fade, as the reference's quarters do. */
const MONTHS = [
  { label: 'May', orders: 1120 },
  { label: 'Jun', orders: 1640 },
  { label: 'Jul', orders: 2310 },
  { label: 'Aug', orders: 3050 },
  { label: 'Sep', orders: 3870 },
] as const;
const MONTH_PEAK = 4000;

const MARKETPLACES = [
  { name: 'Trendyol', closeRate: '71.2%', conversations: '3,343', revenue: '$412.6K' },
  { name: 'Zalando', closeRate: '66.8%', conversations: '2,827', revenue: '$318.4K' },
  { name: 'Shopee', closeRate: '63.1%', conversations: '4,608', revenue: '$287.9K' },
  { name: 'Allegro', closeRate: '58.4%', conversations: '2,612', revenue: '$164.2K' },
] as const;

/** Share of purchases an agent closed without a person stepping in. */
const AGENT_CLOSED = 0.816;
const GAUGE = { size: 188, stroke: 13 };

export function HeroDashboard() {
  const radius = (GAUGE.size - GAUGE.stroke) / 2;

  return (
    <div className="iso-dash">
      <aside className="iso-rail">
        <div className="iso-rail-brand">
          <SculptorsMark className="h-[22px] w-[22px]" />
          <span>Sculptors</span>
          <ChevronsUpDown aria-hidden="true" />
        </div>

        <div className="iso-rail-search" aria-hidden="true">
          <Search />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </div>

        {/* The rail's two sides, as the app has them: Store open, Ads to come. */}
        <div className="iso-rail-switch" aria-hidden="true">
          <span className="is-active">
            <Store />
            Store
          </span>
          <span>
            <Megaphone />
            Ads
          </span>
        </div>

        {NAVIGATION_GROUPS.map(group => (
          <nav key={group.title} aria-label={group.title} className="iso-rail-nav">
            {group.items.map((item, index) => {
              const ItemIcon = item.icon;
              const isCurrent = index === 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isCurrent ? 'is-active' : item.lead ? 'is-lead' : undefined}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  <ItemIcon aria-hidden="true" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        ))}
      </aside>

      <div className="iso-main">
        <header className="iso-top">
          <p className="iso-top-title">
            <LayoutGrid aria-hidden="true" />
            Overview
          </p>
          <div className="iso-top-tools">
            <span className="iso-chip">
              <CalendarDays aria-hidden="true" />
              Last 30 days
              <ChevronDown aria-hidden="true" />
            </span>
            <span className="iso-chip is-quiet">Demo data</span>
            <Link href="/agent-center" className="iso-chip is-ask">
              <Sparkles aria-hidden="true" />
              Ask Sculptors
            </Link>
          </div>
        </header>

        <div className="iso-kpis">
          {KPIS.map(kpi => {
            const KpiIcon = kpi.icon;

            return (
              <article key={kpi.label} className="iso-kpi">
                <p className="iso-kpi-label">
                  <KpiIcon aria-hidden="true" />
                  {kpi.label}
                </p>
                <p className="iso-kpi-value">{kpi.value}</p>
                <p className="iso-kpi-note">{kpi.note}</p>
              </article>
            );
          })}
        </div>

        <div className="iso-grid">
          <article className="iso-card iso-journey">
            <header>
              <div>
                <p className="iso-card-title">
                  Conversation journey
                  <span className="iso-badge">
                    {(JOURNEY.purchaseRate * 100).toFixed(1)}% conversion rate
                  </span>
                </p>
                <p className="iso-card-sub">Every channel the agents sell on, this month</p>
              </div>
            </header>

            <svg
              className="iso-flow"
              viewBox={`0 0 ${FLOW.width} ${FLOW.height}`}
              role="img"
              aria-label={`Conversations by channel, ${Math.round(JOURNEY.purchaseRate * 100)}% ending in a purchase`}
            >
              <defs>
                <linearGradient id="iso-flow-won" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="#34c78a" stopOpacity="0.5" />
                  <stop offset="1" stopColor="#34c78a" stopOpacity="0.62" />
                </linearGradient>
                <linearGradient id="iso-flow-lost" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="#ee8a8a" stopOpacity="0.42" />
                  <stop offset="1" stopColor="#ee8a8a" stopOpacity="0.56" />
                </linearGradient>
              </defs>

              <g className="iso-flow-ribbons">
                {JOURNEY.ribbons.map((ribbon, index) => (
                  <path
                    key={index}
                    d={ribbon.path}
                    fill={ribbon.outcome === 'purchased' ? 'url(#iso-flow-won)' : 'url(#iso-flow-lost)'}
                  />
                ))}
              </g>

              {JOURNEY.sources.map(node => (
                <g key={node.label}>
                  <rect
                    x={FLOW.labelWidth}
                    y={node.y}
                    width={FLOW.bar}
                    height={node.height}
                    rx={2}
                    fill="#0f8a5f"
                  />
                  <text
                    x={FLOW.labelWidth - 12}
                    y={node.y + node.height / 2 - 2}
                    textAnchor="end"
                    className="iso-flow-label"
                  >
                    {node.label}
                  </text>
                  <text
                    x={FLOW.labelWidth - 12}
                    y={node.y + node.height / 2 + 12}
                    textAnchor="end"
                    className="iso-flow-detail"
                  >
                    {node.detail}
                  </text>
                </g>
              ))}

              {[
                { node: JOURNEY.purchased, fill: '#12b76a', tone: 'is-won' },
                { node: JOURNEY.dropped, fill: '#d63a3a', tone: 'is-lost' },
              ].map(({ node, fill, tone }) => (
                <g key={node.label}>
                  <rect
                    x={FLOW.width - FLOW.outcomeWidth}
                    y={node.y}
                    width={FLOW.bar + 2}
                    height={node.height}
                    rx={2}
                    fill={fill}
                  />
                  <text
                    x={FLOW.width - FLOW.outcomeWidth + 20}
                    y={node.y + 16}
                    className={`iso-flow-label ${tone}`}
                  >
                    {node.label}
                  </text>
                  <text
                    x={FLOW.width - FLOW.outcomeWidth + 20}
                    y={node.y + 30}
                    className="iso-flow-detail"
                  >
                    {node.detail}
                  </text>
                </g>
              ))}
            </svg>
          </article>

          <article className="iso-card iso-gauge">
            <p className="iso-card-title">Closed by agents</p>
            <p className="iso-card-sub">Purchases with no person in the thread</p>
            <div className="iso-gauge-ring">
              <svg viewBox={`0 0 ${GAUGE.size} ${GAUGE.size}`} aria-hidden="true">
                <circle
                  cx={GAUGE.size / 2}
                  cy={GAUGE.size / 2}
                  r={radius}
                  fill="none"
                  stroke="#eef1ef"
                  strokeWidth={GAUGE.stroke}
                />
                <circle
                  cx={GAUGE.size / 2}
                  cy={GAUGE.size / 2}
                  r={radius}
                  fill="none"
                  stroke="#12b76a"
                  strokeWidth={GAUGE.stroke}
                  strokeLinecap="round"
                  // Measured in hundredths of the ring, so the stylesheet's
                  // fill-up animation (from "0 100") speaks the same units.
                  pathLength={100}
                  strokeDasharray={`${AGENT_CLOSED * 100} 100`}
                  transform={`rotate(-90 ${GAUGE.size / 2} ${GAUGE.size / 2})`}
                />
              </svg>
              <span className="iso-gauge-value">{(AGENT_CLOSED * 100).toFixed(1)}%</span>
            </div>
            <span className="iso-badge">+4% vs. last month</span>
          </article>

          <article className="iso-card iso-bars">
            <p className="iso-card-title">Orders closed by agents</p>
            <div className="iso-bars-plot">
              <div className="iso-bars-axis" aria-hidden="true">
                <span>4K</span>
                <span>3K</span>
                <span>2K</span>
                <span>1K</span>
                <span>0</span>
              </div>
              <div className="iso-bars-cols">
                {MONTHS.map((month, index) => (
                  <div key={month.label} className="iso-bars-col">
                    <span
                      className="iso-bars-bar"
                      style={{
                        height: `${(month.orders / MONTH_PEAK) * 100}%`,
                        opacity: 0.3 + (0.7 * index) / (MONTHS.length - 1),
                      }}
                    />
                    <span className="iso-bars-month">{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="iso-card iso-table">
            <p className="iso-card-title">Marketplace performance</p>
            <table>
              <thead>
                <tr>
                  <th>Marketplace</th>
                  <th>Close rate</th>
                  <th>Conversations</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {MARKETPLACES.map(row => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className="is-up">{row.closeRate}</td>
                    <td>{row.conversations}</td>
                    <td>{row.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      </div>
    </div>
  );
}
