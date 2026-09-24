/**
 * Time in whole UTC hours.
 *
 * Every period and every bucket is a half-open run of hours, [start, end),
 * written as instants on the hour ('2026-09-22T14:00:00Z'). An hour, a day,
 * a week and a year are then the same kind of thing, and nothing has to
 * special-case midnight.
 *
 * A preset ends at the midnight that starts today: today is still being
 * counted, and a half-counted day reads as a drop. "Today" is the exception:
 * it is today so far, in complete hours, and it is compared with the same
 * hours yesterday.
 */

/** A calendar day, 'YYYY-MM-DD', in UTC. */
export type IsoDate = string;

/** The start of an hour, 'YYYY-MM-DDTHH:00:00Z'. */
export type Instant = string;

/** The hours from `start` up to, not including, `end`. */
export interface TimeInterval {
  start: Instant;
  end: Instant;
}

/** A bucket of a period: its hours, and whether the period cut it short. */
export interface Bucket extends TimeInterval {
  hours: number;
  /** Fewer hours than a whole day, week or month, because the period's edge falls inside it. */
  partial: boolean;
}

export const PRESETS = ['today', 'yesterday', '7d', '30d', '3m', '6m', '12m'] as const;
export type Preset = (typeof PRESETS)[number];

/** A preset, or two calendar days picked by hand (both included). */
export type RangeSelection = { preset: Preset } | { from: IsoDate; to: IsoDate };

export const GRANULARITIES = ['hour', 'day', 'week', 'month'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** The longest custom range, so one request stays cheap: two years. */
export const MAX_CUSTOM_DAYS = 731;

const HOUR_MS = 3_600_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/;

export function isPreset(value: string): value is Preset {
  return (PRESETS as readonly string[]).includes(value);
}

export function isGranularity(value: string): value is Granularity {
  return (GRANULARITIES as readonly string[]).includes(value);
}

/** A real calendar day in the ISO form (2026-02-30 is not one). */
export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE.exec(value);

  if (!match) return false;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  return date.toISOString().slice(0, 10) === value;
}

/** Hours since 1970-01-01T00:00Z. The unit everything here computes in. */
export function hourNumber(instant: Instant): number {
  const time = Date.parse(instant);

  if (!INSTANT.test(instant) || Number.isNaN(time)) throw new RangeError(`Not an instant on the hour: ${instant}`);

  return time / HOUR_MS;
}

export function instantAt(hour: number): Instant {
  return `${new Date(hour * HOUR_MS).toISOString().slice(0, 13)}:00:00Z`;
}

export function startOfDay(date: IsoDate): Instant {
  if (!isIsoDate(date)) throw new RangeError(`Not an ISO date: ${date}`);

  return `${date}T00:00:00Z`;
}

/** The UTC calendar day an instant falls on. */
export function dateOf(instant: Instant | Date): IsoDate {
  return (typeof instant === 'string' ? instant : instant.toISOString()).slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return dateOf(instantAt(hourNumber(startOfDay(date)) + days * 24));
}

/** The same day of the month, months away; the 31st of a short month is its last day. */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const match = ISO_DATE.exec(date);

  if (!match || !isIsoDate(date)) throw new RangeError(`Not an ISO date: ${date}`);

  const first = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();

  return dateOf(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(Number(match[3]), lastDay))));
}

export function hoursIn(interval: TimeInterval): number {
  return hourNumber(interval.end) - hourNumber(interval.start);
}

export function shiftHours(interval: TimeInterval, hours: number): TimeInterval {
  return {
    start: instantAt(hourNumber(interval.start) + hours),
    end: instantAt(hourNumber(interval.end) + hours),
  };
}

/** The last day an interval touches. */
export function lastDateOf(interval: TimeInterval): IsoDate {
  return dateOf(instantAt(hourNumber(interval.end) - 1));
}

/** Monday is 0, Sunday is 6 (ISO weeks). 1970-01-01 was a Thursday. */
export function weekdayOfDay(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

/** The hours a selection covers at `now`. */
export function periodOf(selection: RangeSelection, now: Date): TimeInterval {
  const today = dateOf(now);
  const midnight = startOfDay(today);

  if ('from' in selection) {
    return { start: startOfDay(selection.from), end: startOfDay(addDays(selection.to, 1)) };
  }

  const endingToday = (from: IsoDate) => ({ start: startOfDay(from), end: midnight });

  switch (selection.preset) {
    case 'today':
      // Complete hours only; in the first hour of the day, that one hour.
      return { start: midnight, end: instantAt(hourNumber(midnight) + Math.max(1, now.getUTCHours())) };
    case 'yesterday':
      return endingToday(addDays(today, -1));
    case '7d':
      return endingToday(addDays(today, -7));
    case '30d':
      return endingToday(addDays(today, -30));
    case '3m':
      return endingToday(addMonths(today, -3));
    case '6m':
      return endingToday(addMonths(today, -6));
    case '12m':
      return endingToday(addMonths(today, -12));
  }
}

/**
 * How many hours back the comparison sits: the same hours yesterday for
 * Today (today so far against yesterday up to the same hour), otherwise the
 * period's own length, so the two are the same length and touch.
 */
export function comparisonOffset(selection: RangeSelection, period: TimeInterval): number {
  return 'preset' in selection && selection.preset === 'today' ? 24 : hoursIn(period);
}

/** The bucket sizes that make sense for a period's length, smallest first. */
export function granularitiesFor(period: TimeInterval): readonly Granularity[] {
  const days = hoursIn(period) / 24;

  if (days <= 2) return ['hour'];
  if (days <= 14) return ['day'];
  if (days <= 62) return ['day', 'week'];
  if (days <= 400) return ['day', 'week', 'month'];

  return ['week', 'month'];
}

/** What a period opens on: enough points to see a shape, few enough to read. */
export function defaultGranularity(period: TimeInterval): Granularity {
  const days = hoursIn(period) / 24;

  if (days <= 2) return 'hour';
  if (days <= 45) return 'day';
  if (days <= 400) return 'week';

  return 'month';
}

/** Where the whole bucket containing `hour` starts and ends. */
function naturalBucket(hour: number, granularity: Granularity): { start: number; end: number } {
  if (granularity === 'hour') return { start: hour, end: hour + 1 };

  const day = Math.floor(hour / 24);

  if (granularity === 'day') return { start: day * 24, end: day * 24 + 24 };

  if (granularity === 'week') {
    const monday = day - weekdayOfDay(day);

    return { start: monday * 24, end: monday * 24 + 168 };
  }

  const date = new Date(hour * HOUR_MS);

  return {
    start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / HOUR_MS,
    end: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / HOUR_MS,
  };
}

/**
 * The period cut into hours, days, ISO weeks (Monday to Sunday) or calendar
 * months, oldest first. A bucket the period's edge falls inside is clipped
 * and marked partial; callers draw and label it as such.
 */
export function bucketsOf(period: TimeInterval, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = [];
  const last = hourNumber(period.end);

  for (let start = hourNumber(period.start); start < last; ) {
    const natural = naturalBucket(start, granularity);
    const end = Math.min(natural.end, last);

    buckets.push({
      start: instantAt(start),
      end: instantAt(end),
      hours: end - start,
      partial: end - start < natural.end - natural.start,
    });
    start = end;
  }

  return buckets;
}

/** What is wrong with a custom range, or null when it can be shown. */
export function customRangeProblem(from: IsoDate, to: IsoDate, now: Date): string | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return 'Pick both days.';
  if (from > to) return 'The start comes after the end.';
  if (to > dateOf(now)) return 'The range cannot end in the future.';
  if (hourNumber(startOfDay(to)) - hourNumber(startOfDay(from)) >= MAX_CUSTOM_DAYS * 24) {
    return 'Pick at most two years.';
  }

  return null;
}
