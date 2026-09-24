import { describe, expect, expectTypeOf, it } from 'vitest';
import { getHealthReport, type HealthReport } from '../application/get-health-report';
import { createDemoHealthSource } from '../infrastructure/demo-health-source';
import { healthReportSchema, type HealthReportDto } from './schemas';

describe('healthReportSchema', () => {
  // z.object drops keys it does not know, so equality also catches a field
  // the use case gained that the schema (and so the client) never saw.
  it('describes System Health exactly as the use case builds it', async () => {
    const report = await getHealthReport(createDemoHealthSource(), { now: new Date('2026-09-23T14:35:00Z') });

    expect(healthReportSchema.parse(report)).toEqual(report);
  });

  // Checked by `npm run typecheck`, not at run time. Until 24 Sep the schema
  // cast the component keys to string and restated the status, impact and
  // phase lists, so what the client parsed was looser than the report: a
  // component key off the wire was any string, not a ComponentKey.
  it('parses to the type the use case builds', () => {
    expectTypeOf<HealthReportDto>().toEqualTypeOf<HealthReport>();
  });
});
