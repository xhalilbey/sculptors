import type { OrganizationId } from '@/types/ids';
import type { MetricsSource, TotalsQuery } from '../application/ports';
import { METRIC_KEYS, METRICS, REVENUE_SOURCES, type MetricKey, type RevenueSource } from '../domain/metrics';
import { hourNumber, hoursIn, startOfDay, weekdayOfDay, type TimeInterval } from '../domain/time';

/**
 * Demo numbers for the Store Events Panel until the agents report real
 * events.
 *
 * Made up, but made up the way a store behaves, so the page can be judged on
 * something that looks like real use:
 *
 * - Deterministic. The same organization and hour always give the same
 *   numbers, so a reload does not reshuffle the charts; another organization
 *   gets another, equally plausible store (its own size, growth and rhythm).
 * - One funnel. Every metric follows the day's engaged users: about 23% add
 *   to cart, about 31% of those buy, orders average about $54, and catalogs,
 *   comparison and discovery pages follow engagement.
 * - A rhythm. Evenings are busier than nights, Friday and the weekend busier
 *   than midweek, traffic drifts on slow waves, the store grows a few percent
 *   a month, and refunds improve slowly while cancellations do not -- so some
 *   tiles are green and some red.
 *
 * The hour is the unit: each day's counts are split into whole hours that
 * add up to the day exactly, so an hour, a day and a year all agree.
 */

type DayCounts = Record<MetricKey, number>;

interface DayValues {
  /** Whole-day totals, each the exact sum of its hours. */
  total: DayCounts;
  hourly: Record<MetricKey, number[]>;
}

interface StoreProfile {
  seed: number;
  /** Engaged users on an ordinary day at the start of 2026. */
  baseUsers: number;
  /** Daily growth rate, 0.08% to 0.14% (about 30% to 65% a year). */
  growth: number;
  /** Where in its slow waves this store is, in radians. */
  phase: number;
  sourceWeights: Record<RevenueSource, number>;
  days: Map<number, DayValues>;
}

const ANCHOR_DAY = hourNumber(startOfDay('2026-01-01')) / 24;

/** Monday to Sunday: shoppers talk to agents more on Friday and the weekend. */
const WEEKDAY_FACTORS = [0.94, 0.92, 0.95, 0.98, 1.04, 1.12, 1.08] as const;

/**
 * The share of a day's activity in each UTC hour: quiet overnight, climbing
 * through the working day, highest in the evening of a store in UTC+3.
 */
const HOURLY_SHAPE = [
  0.9, 0.6, 0.45, 0.4, 0.5, 0.9, 1.6, 2.4, 3.1, 3.6, 3.9, 4.1, 4.3, 4.4, 4.7, 5.2, 5.8, 6.2, 6.4, 6.0, 5.1, 3.9, 2.6,
  1.6,
] as const;

const SOURCE_BASE_WEIGHTS: Record<RevenueSource, number> = {
  conversations: 0.44,
  catalogs: 0.21,
  comparisons: 0.15,
  'discovery-pages': 0.2,
};

/** Profiles are rebuilt rarely; their day caches are bounded. */
const PROFILE_CACHE_LIMIT = 64;
const DAY_CACHE_LIMIT = 2_000;

/** FNV-1a: a stable 32-bit number from a string. */
function hash32(text: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** A repeatable number in [0, 1) for a store, a day and a channel. */
function unit(seed: number, day: number, channel: number): number {
  let x = (seed ^ Math.imul(day, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca77)) >>> 0;

  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;

  return (x >>> 0) / 4_294_967_296;
}

/** A factor around 1, spread evenly over `spread` (0.1 is +/-5%). */
function jitter(seed: number, day: number, channel: number, spread: number): number {
  return 1 + spread * (unit(seed, day, channel) - 0.5);
}

/**
 * Splits a whole count into whole parts proportional to the weights that
 * add up to it exactly (largest remainder, ties to the earlier hour).
 */
function allocate(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (total * weight) / weightSum);
  const parts = raw.map(Math.floor);
  let remaining = total - parts.reduce((sum, part) => sum + part, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const { index } of order) {
    if (remaining <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    remaining -= 1;
  }

  return parts;
}

const profiles = new Map<string, StoreProfile>();

function profileOf(organizationId: OrganizationId): StoreProfile {
  const cached = profiles.get(organizationId);

  if (cached) return cached;

  const seed = hash32(organizationId);
  const sourceWeights = Object.fromEntries(
    REVENUE_SOURCES.map((source, index) => [source, SOURCE_BASE_WEIGHTS[source] * jitter(seed, 0, 20 + index, 0.3)])
  ) as Record<RevenueSource, number>;
  const profile: StoreProfile = {
    seed,
    baseUsers: 1400 + (seed % 1200),
    growth: 0.0008 + ((seed >>> 11) % 600) / 1_000_000,
    phase: ((seed >>> 3) % 628) / 100,
    sourceWeights,
    days: new Map(),
  };

  if (profiles.size >= PROFILE_CACHE_LIMIT) profiles.clear();
  profiles.set(organizationId, profile);

  return profile;
}

function dayCounts(store: StoreProfile, day: number): { counts: DayCounts; averageOrder: number } {
  const { seed, baseUsers, growth, phase } = store;
  const t = day - ANCHOR_DAY;
  const wave =
    1 + 0.07 * Math.sin((2 * Math.PI * t) / 38 + phase) + 0.035 * Math.sin((2 * Math.PI * t) / 11 + 2 * phase);
  const engaged = Math.round(
    baseUsers * Math.exp(growth * t) * (WEEKDAY_FACTORS[weekdayOfDay(day)] ?? 1) * wave * jitter(seed, day, 0, 0.12)
  );
  const addToCart = Math.round(engaged * 0.23 * jitter(seed, day, 1, 0.1));
  const purchases = Math.round(addToCart * 0.31 * jitter(seed, day, 2, 0.1));

  return {
    averageOrder: 54 * jitter(seed, day, 3, 0.12),
    counts: {
      'engaged-users': engaged,
      revenue: 0,
      'add-to-cart': addToCart,
      purchases,
      catalogs: Math.round(engaged * 0.021 * jitter(seed, day, 4, 0.2)),
      comparisons: Math.round(
        engaged * 0.034 * (1 + 0.18 * Math.sin((2 * Math.PI * t) / 60 + phase)) * jitter(seed, day, 5, 0.2)
      ),
      'discovery-pages': Math.round(engaged * 0.052 * jitter(seed, day, 6, 0.2)),
      cancellations: Math.round(purchases * 0.024 * jitter(seed, day, 7, 0.5)),
      refunds: Math.round(purchases * 0.019 * Math.exp(-0.0011 * t) * jitter(seed, day, 8, 0.5)),
    },
  };
}

function dayValues(store: StoreProfile, day: number): DayValues {
  const cached = store.days.get(day);

  if (cached) return cached;

  const { counts, averageOrder } = dayCounts(store, day);
  const shape = HOURLY_SHAPE.map((share, hour) => share * jitter(store.seed, day, 40 + hour, 0.3));
  const hourly = {} as Record<MetricKey, number[]>;
  const total = {} as DayCounts;

  for (const key of METRIC_KEYS) {
    if (key === 'revenue') continue;
    hourly[key] = allocate(counts[key], shape);
    total[key] = counts[key];
  }

  // An hour's revenue is its orders at the day's average order value.
  hourly.revenue = hourly.purchases.map((orders) => Math.round(orders * averageOrder * 100) / 100);
  total.revenue = Math.round(hourly.revenue.reduce((sum, value) => sum + value, 0) * 100) / 100;

  const values = { total, hourly };

  if (store.days.size >= DAY_CACHE_LIMIT) store.days.clear();
  store.days.set(day, values);

  return values;
}

function sumOver(store: StoreProfile, metric: MetricKey, interval: TimeInterval): number {
  const first = hourNumber(interval.start);
  const last = hourNumber(interval.end);
  let sum = 0;

  for (let day = Math.floor(first / 24); day * 24 < last; day += 1) {
    const from = Math.max(first, day * 24) - day * 24;
    const to = Math.min(last, day * 24 + 24) - day * 24;
    const values = dayValues(store, day);

    if (from === 0 && to === 24) {
      sum += values.total[metric];
    } else {
      for (let hour = from; hour < to; hour += 1) sum += values.hourly[metric][hour] ?? 0;
    }
  }

  return sum;
}

/**
 * A metric over an interval, aggregated its own way. People return, so the
 * distinct users in a stretch of days are fewer than the sum of each day's:
 * beyond one day the sum shrinks by days^0.3 (a month's users are about 36%
 * of the daily sum, a year's about 17%). Within a day, an hour's users are
 * its share of the day's.
 */
function totalOver(store: StoreProfile, metric: MetricKey, interval: TimeInterval): number {
  const sum = sumOver(store, metric, interval);

  if (METRICS[metric].aggregation === 'unique') {
    return Math.round(sum / Math.pow(Math.max(1, hoursIn(interval) / 24), 0.3));
  }

  return METRICS[metric].unit === 'currency' ? Math.round(sum * 100) / 100 : sum;
}

export function createDemoMetricsSource(): MetricsSource {
  return {
    kind: 'demo',
    currency: 'USD',

    totals({ organizationId, metric, intervals }: TotalsQuery) {
      const store = profileOf(organizationId);

      return Promise.resolve(intervals.map((interval) => totalOver(store, metric, interval)));
    },

    revenueBySource({ organizationId, interval }) {
      const store = profileOf(organizationId);
      const revenue = totalOver(store, 'revenue', interval);
      const weightTotal = REVENUE_SOURCES.reduce((sum, source) => sum + store.sourceWeights[source], 0);
      const split = {} as Record<RevenueSource, number>;
      let assigned = 0;

      // Rounded to cents; the last source takes the remainder so the parts
      // add up to the total exactly.
      REVENUE_SOURCES.forEach((source, index) => {
        const value =
          index === REVENUE_SOURCES.length - 1
            ? Math.round((revenue - assigned) * 100) / 100
            : Math.round(((revenue * store.sourceWeights[source]) / weightTotal) * 100) / 100;

        split[source] = value;
        assigned += value;
      });

      return Promise.resolve(split);
    },
  };
}
