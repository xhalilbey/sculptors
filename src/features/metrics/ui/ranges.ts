import { DEFAULT_PRESET, isIsoDate, isPreset, type Preset, type RangeSelection } from '../domain/time';

/** The presets, in the order the range bar shows them after Custom. */
export const PRESET_OPTIONS: ReadonlyArray<{ value: Preset; label: string; title: string }> = [
  { value: 'today', label: 'Today', title: 'Today so far, in complete hours' },
  { value: 'yesterday', label: 'Yesterday', title: 'Yesterday' },
  { value: '7d', label: '7D', title: 'Last 7 days' },
  { value: '30d', label: '30D', title: 'Last 30 days' },
  { value: '3m', label: '3M', title: 'Last 3 months' },
  { value: '6m', label: '6M', title: 'Last 6 months' },
  { value: '12m', label: '12M', title: 'Last 12 months' },
];

export const DEFAULT_SELECTION: RangeSelection = { preset: DEFAULT_PRESET };

/**
 * The range a page opens on, from its URL (?range=7d, or
 * ?range=custom&from=...&to=...). Anything unreadable opens on the default;
 * a custom range the server refuses (in the future, longer than two years)
 * comes back as the page's error message.
 */
export function selectionFromParams(params: { get(name: string): string | null }): RangeSelection {
  const range = params.get('range');

  if (range === 'custom') {
    const from = params.get('from');
    const to = params.get('to');

    return from && to && isIsoDate(from) && isIsoDate(to) && from <= to ? { from, to } : DEFAULT_SELECTION;
  }

  return range && isPreset(range) ? { preset: range } : DEFAULT_SELECTION;
}
