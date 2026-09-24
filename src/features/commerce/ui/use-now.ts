'use client';

import { useSyncExternalStore } from 'react';

/**
 * The time, once a second, shared by every component that asks: "last seen
 * 2 days ago", "updated 8s ago". Read through an external store so no
 * component calls the clock while it renders. The server has no clock
 * reading to give (0), and the screens using it only draw what they fetched
 * in the browser.
 */

let current = typeof window === 'undefined' ? 0 : Date.now();
const listeners = new Set<() => void>();
let timer: number | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    current = Date.now();
    timer = window.setInterval(() => {
      current = Date.now();
      listeners.forEach((each) => each());
    }, 1000);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) window.clearInterval(timer);
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0
  );
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago". */
export function ago(instant: string, now: number): string {
  const seconds = Math.round((Date.parse(instant) - now) / 1000);
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
  ];
  let value = seconds;

  if (Math.abs(value) < 10) return 'just now';

  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit);

    value /= size;
  }

  return relative.format(Math.round(value), 'year');
}
