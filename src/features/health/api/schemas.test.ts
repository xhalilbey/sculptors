import { describe, expect, it } from 'vitest';
import { getHealthReport } from '../application/get-health-report';
import { createDemoHealthSource } from '../infrastructure/demo-health-source';
import { healthReportSchema } from './schemas';

describe('healthReportSchema', () => {
  // z.object drops keys it does not know, so equality also catches a field
  // the use case gained that the schema (and so the client) never saw.
  it('describes System Health exactly as the use case builds it', async () => {
    const report = await getHealthReport(createDemoHealthSource(), { now: new Date('2026-09-23T14:35:00Z') });

    expect(healthReportSchema.parse(report)).toEqual(report);
  });
});
