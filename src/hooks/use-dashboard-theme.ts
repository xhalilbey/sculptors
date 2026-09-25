'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * The dashboard's theme: the shell (rail and content ground) in dark or in
 * light grey. Chosen in Settings, kept per browser -- it is a viewing
 * preference, not account data -- and read everywhere through this hook.
 *
 * The server does not know the choice, so it renders dark; a browser that
 * chose light switches right after hydration.
 */

export type DashboardTheme = 'dark' | 'light';

const STORAGE_KEY = 'sculptors.dashboard-theme';
const CHANGE_EVENT = 'sculptors:dashboard-theme';

function read(): DashboardTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
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

export function setDashboardTheme(theme: DashboardTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private windows); the choice then lasts for
    // this page only, which the event below still delivers.
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Pins the theme for a subtree, whatever the browser chose. The landing page
 * draws the real Overview inside its hero and needs it in the landing's own
 * light or dark, not in the visitor's dashboard setting.
 */
const ForcedTheme = createContext<DashboardTheme | null>(null);

export const DashboardThemeOverride = ForcedTheme.Provider;

export function useDashboardTheme(): DashboardTheme {
  const forced = useContext(ForcedTheme);
  const stored = useSyncExternalStore<DashboardTheme>(subscribe, read, () => 'dark');

  return forced ?? stored;
}
