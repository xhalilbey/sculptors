import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationId } from '@/types/ids';
import { getMetricDetail } from '../application/get-metric-detail';
import { createDemoMetricsSource } from '../infrastructure/demo-metrics-source';

/**
 * The metric page's bucket-size control, on the server-rendered markup.
 * Until 24 Sep 2026 it pressed Day while the first answer loaded, whatever
 * the URL asked for, and the figures carried a 'USD' fallback nothing ever
 * reached. The control now shows the answer's size, or until it arrives the
 * size the URL names (none when it names none it knows), and the figures are
 * drawn only from an answer, in its own currency.
 */

const useSearchParams = vi.fn();
const useMetricDetail = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/revenue',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams,
}));
vi.mock('./use-metrics', () => ({ useMetricDetail }));

const { MetricDetailScreen } = await import('./metric-detail-screen');

const NOW = new Date('2026-09-23T14:35:00Z');
const ORGANIZATION = 'org_01DETAIL' as OrganizationId;
const LOADING = { data: null, error: null, loading: true, retry: () => undefined };

function render(query: string): string {
  useSearchParams.mockReturnValue(new URLSearchParams(query));

  return renderToStaticMarkup(<MetricDetailScreen metric="revenue" />);
}

/** The bucket-size buttons, as the control drew them. */
function bucketButtons(html: string) {
  const group = html.slice(html.indexOf('aria-label="Bucket size"'));

  return [...group.slice(0, group.indexOf('</div>')).matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(
    ([, attributes = '', label]) => ({
      label,
      pressed: attributes.includes('aria-pressed="true"'),
      disabled: attributes.includes('disabled=""'),
    })
  );
}

describe('MetricDetailScreen', () => {
  it('presses the bucket size the URL asks for while the first answer loads, and offers none yet', () => {
    useMetricDetail.mockReturnValue(LOADING);

    const buttons = bucketButtons(render('range=3m&granularity=week'));

    expect(buttons.map((button) => button.label)).toEqual(['Hour', 'Day', 'Week', 'Month']);
    expect(buttons.filter((button) => button.pressed).map((button) => button.label)).toEqual(['Week']);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it.each(['range=3m', 'range=3m&granularity=fortnight'])(
    'presses no bucket size while it loads when the URL names none it knows (%s)',
    (query) => {
      useMetricDetail.mockReturnValue(LOADING);

      expect(bucketButtons(render(query)).filter((button) => button.pressed)).toEqual([]);
    }
  );

  it("presses the answer's bucket size and writes the answer's currency", async () => {
    const detail = await getMetricDetail(createDemoMetricsSource(), {
      organizationId: ORGANIZATION,
      metric: 'revenue',
      selection: { preset: '3m' },
      granularity: 'month',
      now: NOW,
    });

    useMetricDetail.mockReturnValue({ ...LOADING, data: { ...detail, currency: 'EUR' }, loading: false });

    const html = render('range=3m&granularity=week');

    expect(bucketButtons(html).filter((button) => button.pressed).map((button) => button.label)).toEqual(['Month']);
    expect(html).toContain('€');
    expect(html).not.toContain('$');
  });
});
