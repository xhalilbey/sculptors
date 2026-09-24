import { describe, expect, it } from 'vitest';
import { selectionFromParams } from './ranges';

const params = (query: string) => new URLSearchParams(query);

describe('selectionFromParams', () => {
  it('reads a preset and a custom range from the URL', () => {
    expect(selectionFromParams(params('range=6m'))).toEqual({ preset: '6m' });
    expect(selectionFromParams(params('range=custom&from=2026-08-01&to=2026-08-31'))).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('opens on the last 30 days for anything it cannot read', () => {
    expect(selectionFromParams(params(''))).toEqual({ preset: '30d' });
    expect(selectionFromParams(params('range=forever'))).toEqual({ preset: '30d' });
    expect(selectionFromParams(params('range=custom&from=2026-09-10&to=2026-09-01'))).toEqual({ preset: '30d' });
    expect(selectionFromParams(params('range=custom&from=2026-02-30&to=2026-03-01'))).toEqual({ preset: '30d' });
  });
});
