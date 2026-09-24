'use client';

import { ArrowRight, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Tone } from '@/components/charts/verdict';
import { darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { useRemote } from '@/hooks/use-remote';
import { cn } from '@/lib/utils';
import { fetchOrders } from '../api/client';
import {
  DEFAULT_ORDER_FILTERS,
  filterOrders,
  ORDER_STAGES,
  STAGE_LABELS,
  stageOf,
  type Order,
  type OrderFilters,
  type StageFilter,
} from '../domain/orders';
import { FilterChips, LoadError, NoMatches, ResultCount, SearchField } from './toolbar';
import { ago, useNow } from './use-now';

/**
 * Orders: the latest orders as live tracking cards (owner's direction, 23
 * Sep 2026). Each shows who and what, then its way to the door as a line of
 * five stops -- reached ones solid, the rest dotted -- with the time each
 * was reached, the carrier and when it arrives. The board asks again every
 * 15 seconds, so new orders come in and cards move on their own.
 */

const POLL_MS = 15_000;
/** An order this recent wears a "New" tag. */
const NEW_FOR_MS = 15 * 60_000;

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayAndClock = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "14:02" today, "22 Sep, 22:10" otherwise, in the viewer's own time. */
function whenReached(instant: string, now: number): string {
  const at = new Date(instant);

  return new Date(now).toDateString() === at.toDateString() ? clock.format(at) : dayAndClock.format(at);
}

/** "today by 06:30", "tomorrow by 11:15", "on 26 Sep". */
function arrival(eta: string, now: number): string {
  const at = new Date(eta);
  const today = new Date(now);
  const tomorrow = new Date(now + 86_400_000);

  if (today.toDateString() === at.toDateString()) return `today by ${clock.format(at)}`;
  if (tomorrow.toDateString() === at.toDateString()) return `tomorrow by ${clock.format(at)}`;

  return `on ${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

/** The hollow stop has to hide the dotted line behind it, so it takes the card's own face. */
const STOP_FACE: Record<Tone, string> = { dark: 'bg-[#1b1b1e]', light: 'bg-white' };

function DeliveryTrack({ order, now, tone }: { order: Order; now: number; tone: Tone }) {
  const current = stageOf(order);

  return (
    <ol className="mt-5 grid grid-cols-5" aria-label={`On its way: ${STAGE_LABELS[current]}`}>
      {ORDER_STAGES.map((stage, index) => {
        const reached = order.reached.find((step) => step.stage === stage);
        const isCurrent = stage === current && stage !== 'delivered';
        const isDone = reached !== undefined;

        return (
          <li key={stage} className="relative flex flex-col items-center text-center">
            {index > 0 ? (
              <span
                className={cn(
                  'absolute right-1/2 top-[7px] w-full border-t-2',
                  isDone ? 'border-solid border-[var(--card-text-soft)]' : 'border-dotted border-[var(--card-text-faint)]'
                )}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 flex h-4 w-4 items-center justify-center rounded-full border-2',
                isCurrent
                  ? 'border-[#4f7dff] bg-[#4f7dff]'
                  : isDone
                    ? 'border-[var(--card-text-soft)] bg-[var(--card-text-soft)]'
                    : cn('border-[var(--card-text-faint)]', STOP_FACE[tone])
              )}
              aria-hidden="true"
            >
              {isCurrent ? <span className="absolute inset-[-5px] animate-ping rounded-full border border-[#4f7dff]/60" /> : null}
              {stage === 'delivered' && isDone ? <Check className={cn('h-2.5 w-2.5', tone === 'dark' ? 'text-black' : 'text-white')} strokeWidth={4} /> : null}
            </span>
            <span className={cn('mt-2 text-[11px] font-medium leading-4', isDone ? 'text-[var(--card-text)]' : 'text-[var(--card-text-faint)]')}>
              {STAGE_LABELS[stage]}
            </span>
            <span className="text-[11px] tabular-nums leading-4 text-[var(--card-text-faint)]">
              {reached && now > 0 ? whenReached(reached.at, now) : '—'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({ order, currency, now, tone }: { order: Order; currency: string; now: number; tone: Tone }) {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  const stage = stageOf(order);
  const placedAt = order.reached[0]?.at;
  const isNew = placedAt !== undefined && now > 0 && now - Date.parse(placedAt) < NEW_FOR_MS;
  const delivered = order.reached.find((step) => step.stage === 'delivered');

  return (
    <article className={cn(tone === 'dark' ? darkCard : lightCard, 'p-5')}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--card-text)]">
            <span className="font-mono tracking-[-0.02em]">#{order.id}</span>
            {isNew ? (
              <span className="rounded-full border border-[var(--dashboard-line)] px-1.5 text-[11px] font-semibold text-[var(--card-text-soft)]">New</span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-[var(--card-text-muted)]">
            {order.customer.name} · {order.customer.city}, {order.customer.country}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-semibold tabular-nums text-[var(--card-text)]">{money.format(order.total)}</p>
          <p className="text-[12px] text-[var(--card-text-faint)]">
            {order.items} {order.items === 1 ? 'item' : 'items'}
          </p>
        </div>
      </header>

      <DeliveryTrack order={order} now={now} tone={tone} />

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-[var(--card-line)] pt-3.5 text-[12px] text-[var(--card-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          {order.from}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          {order.customer.city}
        </span>
        <span className="truncate">
          {order.carrier} · <span className="font-mono">{order.tracking}</span>
        </span>
        <span className="font-medium text-[var(--card-text)]">
          {stage === 'delivered' && delivered
            ? `Delivered ${now > 0 ? ago(delivered.at, now) : ''}`
            : now > 0
              ? `Arrives ${arrival(order.eta, now)}`
              : ''}
        </span>
      </footer>
    </article>
  );
}

export function OrdersScreen() {
  const theme = useDashboardTheme();
  const now = useNow();
  const { data, error, retry } = useRemote(fetchOrders, { pollMs: POLL_MS });
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS);
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const shown = useMemo(() => filterOrders(orders, filters), [orders, filters]);
  const stageOptions = useMemo(() => {
    const countOf = (stage: StageFilter) => filterOrders(orders, { query: '', stage }).length;

    return [
      { value: 'active' as const, label: 'On the way', count: countOf('active') },
      { value: 'all' as const, label: 'All', count: orders.length },
      ...ORDER_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage], count: countOf(stage) })),
    ];
  }, [orders]);

  return (
    <section className="min-h-full px-6 pb-14 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em]">Orders</h1>
        {data ? (
          <p className="inline-flex items-center gap-2 pb-1 text-[13px] text-[var(--dashboard-text-muted)]" aria-live="polite">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2ecc71] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2ecc71]" />
            </span>
            Live · updated {now > 0 ? ago(data.checkedAt, now) : 'just now'}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SearchField value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Search orders or tracking" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Stage" options={stageOptions} value={filters.stage} onChange={(stage) => setFilters({ ...filters, stage })} />
        {data ? <ResultCount shown={shown.length} total={orders.length} noun={['order', 'orders']} /> : null}
      </div>

      {error && !data ? <LoadError message={error} onRetry={retry} /> : null}

      {data ? (
        shown.length > 0 ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {shown.map((order) => (
              <OrderCard key={order.id} order={order} currency={data.currency} now={now} tone={theme} />
            ))}
          </div>
        ) : (
          <NoMatches noun="orders" onClear={() => setFilters(DEFAULT_ORDER_FILTERS)} />
        )
      ) : !error ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={cn(theme === 'dark' ? darkCard : lightCard, 'h-[214px] animate-pulse')} />
          ))}
          <span className="sr-only">Loading orders</span>
        </div>
      ) : null}
    </section>
  );
}
