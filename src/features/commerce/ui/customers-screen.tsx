'use client';

import { useMemo, useState } from 'react';
import type { Tone } from '@/components/charts/verdict';
import { darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { cn } from '@/lib/utils';
import { fetchCustomers } from '../api/client';
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_SORT_LABELS,
  CUSTOMER_SORTS,
  DEFAULT_CUSTOMER_FILTERS,
  filterCustomers,
  SEGMENT_LABELS,
  type Customer,
  type CustomerFilters,
  type CustomerSegment,
} from '../domain/customers';
import { FilterChips, LoadError, NoMatches, PickMenu, ResultCount, SearchField } from './toolbar';
import { ago, useNow } from './use-now';
import { useRemote } from './use-remote';

/**
 * Customers: everyone who bought, as a card in the Products page's make --
 * who and where, their segment, and what they did: orders, spend and the
 * product pages they viewed (owner's direction, 23 Sep 2026). A search, the
 * segment and country filters, and a sort.
 */

const whole = new Intl.NumberFormat('en-US');
const counts = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-[var(--card-text-faint)]">{label}</p>
      <p className="mt-0.5 truncate text-[16px] font-semibold tabular-nums text-[var(--card-text)]">{value}</p>
    </div>
  );
}

function CustomerCard({ customer, currency, now, tone }: { customer: Customer; currency: string; now: number; tone: Tone }) {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });

  return (
    <article className={cn(tone === 'dark' ? darkCard : lightCard, 'flex flex-col p-5')}>
      <div className="flex items-start gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--dashboard-line)] bg-[var(--card-fill)] text-[14px] font-semibold text-[var(--card-text-soft)]"
          aria-hidden="true"
        >
          {initialsOf(customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-[var(--card-text)]">{customer.name}</h3>
          <p className="truncate text-[12px] text-[var(--card-text-faint)]">
            {customer.city}, {customer.country}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
            customer.segment === 'vip'
              ? 'border-[var(--card-text-soft)] text-[var(--card-text)]'
              : 'border-[var(--dashboard-line)] text-[var(--card-text-muted)]'
          )}
        >
          {SEGMENT_LABELS[customer.segment]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--card-line)] pt-3.5">
        <Stat label="Orders" value={whole.format(customer.orders)} />
        <Stat label="Spent" value={money.format(customer.spent)} />
        <Stat label="Views · 30 days" value={counts.format(customer.views)} />
      </div>

      <p className="mt-3.5 truncate text-[12px] text-[var(--card-text-faint)]">
        Last seen {now > 0 ? ago(customer.lastSeen, now) : new Date(customer.lastSeen).toLocaleDateString('en-US')} · {customer.email}
      </p>
    </article>
  );
}

export function CustomersScreen() {
  const theme = useDashboardTheme();
  const now = useNow();
  const { data, error, retry } = useRemote(fetchCustomers);
  const [filters, setFilters] = useState<CustomerFilters>(DEFAULT_CUSTOMER_FILTERS);
  const customers = useMemo(() => data?.customers ?? [], [data]);
  const shown = useMemo(() => filterCustomers(customers, filters), [customers, filters]);
  const segmentOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All', count: customers.length },
      ...CUSTOMER_SEGMENTS.map((segment: CustomerSegment) => ({
        value: segment,
        label: SEGMENT_LABELS[segment],
        count: customers.filter((customer) => customer.segment === segment).length,
      })),
    ],
    [customers]
  );
  const countryOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...[...new Set(customers.map((customer) => customer.country))].sort().map((country) => ({ value: country, label: country })),
    ],
    [customers]
  );

  return (
    <section className="min-h-full px-6 pb-14 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em]">Customers</h1>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SearchField value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Search customers or email" />
        <PickMenu label="Country" options={countryOptions} value={filters.country} onChange={(country) => setFilters({ ...filters, country })} />
        <PickMenu
          label="Sort"
          options={CUSTOMER_SORTS.map((sort) => ({ value: sort, label: CUSTOMER_SORT_LABELS[sort] }))}
          value={filters.sort}
          onChange={(sort) => setFilters({ ...filters, sort })}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Segment" options={segmentOptions} value={filters.segment} onChange={(segment) => setFilters({ ...filters, segment })} />
        {data ? <ResultCount shown={shown.length} total={customers.length} noun={['customer', 'customers']} /> : null}
      </div>

      {error && !data ? <LoadError message={error} onRetry={retry} /> : null}

      {data ? (
        shown.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} currency={data.currency} now={now} tone={theme} />
            ))}
          </div>
        ) : (
          <NoMatches noun="customers" onClear={() => setFilters(DEFAULT_CUSTOMER_FILTERS)} />
        )
      ) : !error ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={cn(theme === 'dark' ? darkCard : lightCard, 'h-[196px] animate-pulse')} />
          ))}
          <span className="sr-only">Loading customers</span>
        </div>
      ) : null}
    </section>
  );
}
