import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The webhook is the one route WorkOS calls without a session. Its failure
 * directions are what matter: no secret must mean nothing is accepted, a
 * bad signature must mean nothing is recorded or applied, a replayed
 * event must not be applied twice, and a failed one must be applied when
 * WorkOS delivers it again.
 */

const constructEvent = vi.fn();
const recordWebhookEvent = vi.fn();
const applyWebhookEvent = vi.fn();
const markWebhookEventProcessed = vi.fn();
const markWebhookEventFailed = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/client', () => ({
  getWorkOSClient: () => ({ webhooks: { constructEvent } }),
}));
vi.mock('@/lib/workos/webhook-sync', () => ({
  recordWebhookEvent,
  applyWebhookEvent,
  markWebhookEventProcessed,
  markWebhookEventFailed,
}));

const { POST } = await import('./route');

const ORIGINAL = { ...process.env };

function request(body: unknown, signature?: string) {
  const headers = new Headers({ 'content-type': 'application/json' });

  if (signature) headers.set('workos-signature', signature);

  return new NextRequest('http://localhost/api/auth/workos/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const EVENT = { id: 'event_1', event: 'organization.updated', data: { id: 'org_1', name: 'Codeon' } };

beforeEach(() => {
  process.env.WORKOS_WEBHOOK_SECRET = 'whsec_test';
  for (const mock of [constructEvent, recordWebhookEvent, applyWebhookEvent, markWebhookEventProcessed, markWebhookEventFailed]) {
    mock.mockReset();
  }
  markWebhookEventFailed.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('POST /api/auth/workos/webhook', () => {
  it('refuses every delivery when no secret is configured', async () => {
    delete process.env.WORKOS_WEBHOOK_SECRET;

    const response = await POST(request({ id: 'event_1', event: 'organization.created' }, 'sig'));

    expect(response.status).toBe(503);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(recordWebhookEvent).not.toHaveBeenCalled();
  });

  it('refuses a delivery without a signature header before touching the client', async () => {
    const response = await POST(request({ id: 'event_1', event: 'organization.created' }));

    expect(response.status).toBe(401);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(recordWebhookEvent).not.toHaveBeenCalled();
  });

  it('records and applies nothing when the signature does not verify', async () => {
    constructEvent.mockRejectedValue(new Error('SignatureVerificationException'));

    const response = await POST(request({ id: 'event_1', event: 'organization.created' }, 'bad'));

    expect(response.status).toBe(401);
    expect(recordWebhookEvent).not.toHaveBeenCalled();
    expect(applyWebhookEvent).not.toHaveBeenCalled();
  });

  it('verifies the payload exactly as it was received', async () => {
    const body = { id: 'event_1', event: 'organization.updated', data: { id: 'org_1', name: 'Codeon' } };

    constructEvent.mockRejectedValue(new Error('SignatureVerificationException'));
    await POST(request(body, 'sig'));

    expect(constructEvent).toHaveBeenCalledWith({ payload: body, sigHeader: 'sig', secret: 'whsec_test' });
  });

  it('acknowledges a replayed event without applying it again', async () => {
    constructEvent.mockResolvedValue(EVENT);
    recordWebhookEvent.mockResolvedValue('duplicate');

    const response = await POST(request({}, 'good'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(applyWebhookEvent).not.toHaveBeenCalled();
    expect(markWebhookEventProcessed).not.toHaveBeenCalled();
  });

  it('records, applies and marks a new event processed', async () => {
    constructEvent.mockResolvedValue(EVENT);
    recordWebhookEvent.mockResolvedValue('recorded');

    const response = await POST(request({}, 'good'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(applyWebhookEvent).toHaveBeenCalledWith(EVENT);
    expect(markWebhookEventProcessed).toHaveBeenCalledWith('event_1');
  });

  it('applies again a redelivery of an event whose earlier apply failed', async () => {
    constructEvent.mockResolvedValue(EVENT);
    recordWebhookEvent.mockResolvedValue('retry');

    const response = await POST(request({}, 'good'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(applyWebhookEvent).toHaveBeenCalledWith(EVENT);
    expect(markWebhookEventProcessed).toHaveBeenCalledWith('event_1');
  });

  it('keeps the failure and answers 500 when applying fails', async () => {
    constructEvent.mockResolvedValue(EVENT);
    recordWebhookEvent.mockResolvedValue('recorded');
    const failure = new Error('constraint violated');

    applyWebhookEvent.mockRejectedValue(failure);

    const response = await POST(request({}, 'good'));

    expect(response.status).toBe(500);
    expect(markWebhookEventProcessed).not.toHaveBeenCalled();
    // The error itself: webhook-sync turns it into a note without the SQL.
    expect(markWebhookEventFailed).toHaveBeenCalledWith('event_1', failure);
  });

  it('answers 500 without applying when the event cannot be recorded', async () => {
    constructEvent.mockResolvedValue(EVENT);
    recordWebhookEvent.mockRejectedValue(new Error('database down'));

    const response = await POST(request({}, 'good'));

    expect(response.status).toBe(500);
    expect(applyWebhookEvent).not.toHaveBeenCalled();
  });
});
