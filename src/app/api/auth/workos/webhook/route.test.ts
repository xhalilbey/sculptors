import { SignatureVerificationException } from '@workos-inc/node';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The webhook is the one route WorkOS calls without a session. Its failure
 * directions are what matter: no secret must mean nothing is accepted, a
 * bad signature must mean nothing is recorded or applied, a replayed
 * event must not be applied twice, and a failed one must be applied when
 * WorkOS delivers it again. Only the SDK's SignatureVerificationException
 * is a bad signature: an event that verified but cannot be read is a 500,
 * so WorkOS retries it, and it is logged as what it is.
 */

const constructEvent = vi.fn();
const recordWebhookEvent = vi.fn();
const applyWebhookEvent = vi.fn();
const markWebhookEventProcessed = vi.fn();
const markWebhookEventFailed = vi.fn();
const warn = vi.fn();
const error = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn, error, info: vi.fn(), debug: vi.fn() },
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
const BAD_SIGNATURE = new SignatureVerificationException(
  'Signature hash does not match the expected signature hash for payload'
);

beforeEach(() => {
  process.env.WORKOS_WEBHOOK_SECRET = 'whsec_test';
  for (const mock of [constructEvent, recordWebhookEvent, applyWebhookEvent, markWebhookEventProcessed, markWebhookEventFailed, warn, error]) {
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
    constructEvent.mockRejectedValue(BAD_SIGNATURE);

    const response = await POST(request({ id: 'event_1', event: 'organization.created' }, 'bad'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid signature' });
    expect(warn).toHaveBeenCalledWith('WorkOS webhook signature rejected', { errorType: 'SignatureVerificationException' });
    expect(recordWebhookEvent).not.toHaveBeenCalled();
    expect(applyWebhookEvent).not.toHaveBeenCalled();
  });

  it('answers 500 and records nothing when a verified event cannot be read', async () => {
    // What the SDK's deserializer throws for, say, an organization without
    // `domains`: the signature has already verified by then.
    constructEvent.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'map')"));

    const response = await POST(request(EVENT, 'good'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to read event' });
    expect(error).toHaveBeenCalledWith('Failed to deserialize a verified WorkOS event', {
      errorType: 'TypeError',
      eventId: 'event_1',
      type: 'organization.updated',
    });
    expect(warn).not.toHaveBeenCalled();
    expect(recordWebhookEvent).not.toHaveBeenCalled();
    expect(applyWebhookEvent).not.toHaveBeenCalled();
  });

  it('verifies the payload exactly as it was received', async () => {
    const body = { id: 'event_1', event: 'organization.updated', data: { id: 'org_1', name: 'Codeon' } };

    constructEvent.mockRejectedValue(BAD_SIGNATURE);
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
