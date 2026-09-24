import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationId } from '@/types/ids';
import { getMetricDetail } from '../application/get-metric-detail';
import { getOverview } from '../application/get-overview';
import { createDemoMetricsSource } from '../infrastructure/demo-metrics-source';
import { metricDetailQuerySchema, metricDetailSchema, overviewQuerySchema, overviewSchema } from './schemas';

const NOW = new Date('2026-09-23T14:35:00Z');
const ORGANIZATION = 'org_01SCHEMA' as OrganizationId;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the response schemas', () => {
  // z.object drops keys it does not know, so equality also catches a field
  // the use case gained that the schema (and so the client) never saw.
  it('describe the Overview exactly as the use case builds it', async () => {
    const overview = await getOverview(createDemoMetricsSource(), {
      organizationId: ORGANIZATION,
      selection: { preset: '3m' },
      now: NOW,
    });

    expect(overviewSchema.parse(overview)).toEqual(overview);
  });

  it('describe a metric exactly as the use case builds it', async () => {
    const detail = await getMetricDetail(createDemoMetricsSource(), {
      organizationId: ORGANIZATION,
      metric: 'revenue',
      selection: { from: '2026-07-01', to: '2026-07-31' },
      now: NOW,
    });

    expect(metricDetailSchema.parse(detail)).toEqual(detail);
  });
});

describe('overviewQuerySchema', () => {
  it('opens on the last 30 days and reads presets and custom ranges', () => {
    expect(overviewQuerySchema.parse({})).toEqual({ selection: { preset: '30d' } });
    expect(overviewQuerySchema.parse({ range: 'today' })).toEqual({ selection: { preset: 'today' } });
    expect(overviewQuerySchema.parse({ range: 'custom', from: '2026-08-01', to: '2026-08-31' })).toEqual({
      selection: { from: '2026-08-01', to: '2026-08-31' },
    });
  });

  it('refuses an unknown preset, a custom range without its days, and one in the future', () => {
    expect(overviewQuerySchema.safeParse({ range: '90d' }).success).toBe(false);
    expect(overviewQuerySchema.safeParse({ range: 'custom', from: '2026-08-01' }).success).toBe(false);
    expect(overviewQuerySchema.safeParse({ range: 'custom', from: '2026-09-01', to: '2026-09-30' }).success).toBe(false);
  });
});

describe('metricDetailQuerySchema', () => {
  it('accepts a bucket size the range offers and leaves a missing one to the server', () => {
    expect(metricDetailQuerySchema.parse({ range: '12m', granularity: 'month' })).toEqual({
      selection: { preset: '12m' },
      granularity: 'month',
    });
    expect(metricDetailQuerySchema.parse({ range: '7d' })).toEqual({ selection: { preset: '7d' }, granularity: undefined });
  });

  it('refuses a bucket size the range does not offer', () => {
    expect(metricDetailQuerySchema.safeParse({ range: '7d', granularity: 'month' }).success).toBe(false);
    expect(metricDetailQuerySchema.safeParse({ range: 'today', granularity: 'day' }).success).toBe(false);
  });
});
