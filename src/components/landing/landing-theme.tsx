'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

/**
 * The landing page's theme, light or dark, switched from the footer (owner's
 * direction, 24 Sep 2026: "let me switch it from the bottom and see how dark
 * looks"). Kept per browser, like the dashboard's theme
 * (hooks/use-dashboard-theme.ts), and separate from it: a visitor's choice on
 * the public page says nothing about how they want the app.
 *
 * The page's root carries it as data-theme; globals.css swaps the landing
 * tokens (--color-lp-*) under [data-theme='dark']. The server does not know
 * the choice, so it renders light; a browser that chose dark switches right
 * after hydration.
 */

export type LandingTheme = 'light' | 'dark';

const STORAGE_KEY = 'sculptors.landing-theme';
const CHANGE_EVENT = 'sculptors:landing-theme';

function read(): LandingTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab changing it.
  window.addEventListener('storage', onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function setLandingTheme(theme: LandingTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private windows); the choice then lasts for
    // this page only, which the event below still delivers.
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useLandingTheme(): LandingTheme {
  return useSyncExternalStore(subscribe, read, () => 'light');
}

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

/** Light | Dark, as a two-key switch in the footer's bottom row. */
export function LandingThemeSwitch() {
  const theme = useLandingTheme();

  return (
    <div className="lp-theme-switch" role="group" aria-label="Theme">
      {OPTIONS.map(option => {
        const OptionIcon = option.icon;
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            className={isActive ? 'is-active' : undefined}
            aria-pressed={isActive}
            onClick={() => setLandingTheme(option.value)}
          >
            <OptionIcon aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
