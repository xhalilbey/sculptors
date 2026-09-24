import type { KpiUnit, MetricUnit } from '../domain/metrics';
import {
  dateOf,
  hourNumber,
  hoursIn,
  instantAt,
  lastDateOf,
  startOfDay,
  type Bucket,
  type Granularity,
  type IsoDate,
  type TimeInterval,
} from '../domain/time';

/**
 * Numbers and times as the panel writes them. English, like the rest of the
 * interface; times are UTC, like the periods.
 */

const LOCALE = 'en-US';

const counts = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compactCounts = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
const percents = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type MoneyVariant = 'whole' | 'cents' | 'compact';

const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string, variant: MoneyVariant): Intl.NumberFormat {
  const key = `${currency}:${variant}`;
  const cached = moneyFormats.get(key);

  if (cached) return cached;

  const format = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    ...(variant === 'compact'
      ? // The minimum is explicit: engines differ on its default here (Node 20 wrote "$15.0K").
        { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }
      : variant === 'whole'
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  });

  moneyFormats.set(key, format);

  return format;
}

/** Whole units for totals, cents for small amounts such as an order's value. */
export function formatMoney(value: number, currency: string, options: { compact?: boolean; cents?: boolean } = {}): string {
  const variant: MoneyVariant = options.compact ? 'compact' : options.cents ? 'cents' : 'whole';

  return moneyFormat(currency, variant).format(value);
}

export function formatCount(value: number, options: { compact?: boolean } = {}): string {
  return (options.compact ? compactCounts : counts).format(value);
}

export function formatMetricValue(
  value: number,
  unit: MetricUnit,
  currency: string,
  options: { compact?: boolean } = {}
): string {
  return unit === 'currency' ? formatMoney(value, currency, options) : formatCount(value, options);
}

export function formatPercent(ratio: number): string {
  return percents.format(ratio);
}

/** A revenue figure in its own unit; a ratio with nothing to divide by is a dash. */
export function formatKpi(value: number | null, unit: KpiUnit, currency: string, compact = false): string {
  if (value === null) return '—';
  if (unit === 'currency') return formatMoney(value, currency, { compact });
  if (unit === 'currency-cents') return formatMoney(value, currency, compact ? { compact } : { cents: true });
  if (unit === 'percent') return formatPercent(value);

  return formatCount(value, { compact });
}

const dayFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayYearFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' });
const monthYearFormat = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const hourFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

const toDate = (instant: string) => new Date(instant);

/** The start of an interval's last hour: the last moment it covers, on the hour. */
function lastHourOf(interval: TimeInterval): Date {
  return toDate(instantAt(hourNumber(interval.end) - 1));
}

/** "Aug 24 – Sep 22, 2026"; the year is written once when both ends share it. */
export function formatDays(from: IsoDate, to: IsoDate): string {
  const start = toDate(startOfDay(from));
  const end = toDate(startOfDay(to));

  return from === to ? dayYearFormat.format(start) : dayYearFormat.formatRange(start, end);
}

/**
 * A period as a caption: its days, or, when it is part of one day (today so
 * far), the day and its hours.
 */
export function formatPeriod(interval: TimeInterval): string {
  const start = toDate(interval.start);

  if (hoursIn(interval) < 24) {
    return `${dayYearFormat.format(start)}, ${hourFormat.format(start)}–${hourFormat.format(toDate(interval.end))} UTC`;
  }

  return formatDays(dateOf(interval.start), lastDateOf(interval));
}

/** A bucket as a heading: an hour, a day, a week's span, or a month (its span when clipped). */
export function formatBucket(bucket: Bucket, granularity: Granularity): string {
  const start = toDate(bucket.start);

  if (granularity === 'hour') {
    return `${dayFormat.format(start)}, ${hourFormat.format(start)}–${hourFormat.format(toDate(bucket.end))}`;
  }

  if (granularity === 'day') return dayYearFormat.format(start);
  if (granularity === 'month' && !bucket.partial) return monthYearFormat.format(start);

  return dayYearFormat.formatRange(start, lastHourOf(bucket));
}

/** A bucket as an axis tick: its hour, its first day, or its month. */
export function formatTick(bucket: Bucket, granularity: Granularity): string {
  const start = toDate(bucket.start);

  if (granularity === 'hour') return hourFormat.format(start);
  if (granularity === 'month') return monthFormat.format(start);

  return dayFormat.format(start);
}

/** Under a clipped bucket's heading: "3 days of this week in range". */
export function formatPartialNote(bucket: Bucket, granularity: Granularity): string | undefined {
  if (!bucket.partial || granularity === 'hour') return undefined;

  const days = Math.round(bucket.hours / 24);

  return `${days} ${days === 1 ? 'day' : 'days'} of this ${granularity} in range`;
}
