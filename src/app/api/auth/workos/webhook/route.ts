import { SignatureVerificationException, type Event } from '@workos-inc/node';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { definePublicRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';
import { getWorkOSClient } from '@/lib/workos/client';
import {
  applyWebhookEvent,
  markWebhookEventFailed,
  markWebhookEventProcessed,
  recordWebhookEvent,
} from '@/lib/workos/webhook-sync';

/**
 * POST /api/auth/workos/webhook -- WorkOS tells us about organizations,
 * memberships and users changed outside a sign-in (the dashboard, an admin
 * portal, SCIM). This keeps the mirror honest between sign-ins.
 *
 * Three guarantees:
 *   - Nothing is processed unless the signature verifies against
 *     WORKOS_WEBHOOK_SECRET. No secret configured means every delivery is
 *     refused with 503, not accepted: this fails closed.
 *   - Every accepted event is recorded by its WorkOS id first. A redelivery
 *     of an applied event is acknowledged without being applied twice; a
 *     redelivery of one whose apply failed is applied again.
 *   - Applying only ever MIRRORS (lib/workos/webhook-sync.ts).
 */
export const POST = definePublicRoute({
  justification:
    'WorkOS webhook receiver. WorkOS sends no session cookie and no same-origin ' +
    'header; every event is authenticated by its WorkOS-Signature header ' +
    '(webhooks.constructEvent) before anything is recorded or applied.',
  // Checked to be an object and passed on untouched: WorkOS signs
  // JSON.stringify of the payload, so it must not be rebuilt. The signature,
  // not a schema, decides whether to trust it.
  body: z.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    'Invalid JSON'
  ),
  handler: async ({ body: payload }, { headers }) => {
    const secret = process.env.WORKOS_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('WORKOS_WEBHOOK_SECRET is not configured; refusing webhook');

      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const sigHeader = headers.get('workos-signature');

    if (!sigHeader) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Built outside the try below, so the catch there sees only what
    // constructEvent throws. getWorkOSClient throws a plain Error when a
    // WorkOS key is missing or the cookie password is short; that reaches
    // definePublicRoute, which logs it with its message and answers 500.
    // Inside the try (24 Sep) it was logged as a verified event that could
    // not be read, with the caller's own id and type beside it, before any
    // signature had been checked.
    const { webhooks } = getWorkOSClient();

    let event: Event;

    try {
      // Verifies the signature, then deserializes: the event is camelCase.
      event = await webhooks.constructEvent({ payload, sigHeader, secret });
    } catch (error) {
      // Only a signature problem is the sender's fault. The SDK's
      // verifyHeader (9.1.1) throws SignatureVerificationException, and
      // nothing else, for every one: no t= or v1=, no hash, a hash that does
      // not match, or a timestamp older than its default 180 s tolerance
      // (the replay window, which route.seam.db.test.ts pins). Until 24 Sep
      // every error here was answered 401 'Invalid signature', so an event
      // that verified but could not be deserialized was logged as a forgery.
      if (error instanceof SignatureVerificationException) {
        logger.warn('WorkOS webhook signature rejected', { errorType: error.name });

        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      // Anything else came from the deserializer, after the signature
      // verified, so the id and type in the raw payload are WorkOS's own and
      // safe to log; no data field is. Nothing has been recorded yet, and a
      // 500 makes WorkOS deliver the event again.
      logger.error('Failed to deserialize a verified WorkOS event', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
        eventId: typeof payload.id === 'string' ? payload.id : undefined,
        type: typeof payload.event === 'string' ? payload.event : undefined,
      });

      return NextResponse.json({ error: 'Failed to read event' }, { status: 500 });
    }

    if (!event?.id || !event.event) {
      return NextResponse.json({ error: 'Malformed event' }, { status: 400 });
    }

    let outcome: Awaited<ReturnType<typeof recordWebhookEvent>>;

    try {
      outcome = await recordWebhookEvent(event);
    } catch (error) {
      logger.error('Failed to record WorkOS webhook event', { error, eventId: event.id });

      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
    }

    // 'recorded' (new) and 'retry' (seen, never applied) are both applied.
    if (outcome === 'duplicate') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      await applyWebhookEvent(event);
      await markWebhookEventProcessed(event.id);
    } catch (error) {
      logger.error('Failed to apply WorkOS webhook event', { error, eventId: event.id, type: event.event });
      await markWebhookEventFailed(event.id, error).catch(() => undefined);

      // WorkOS retries on 500, and the retry is applied again ('retry'):
      // the error stays in workos_webhook_events.error until an attempt
      // succeeds.
      return NextResponse.json({ error: 'Failed to apply event' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  },
});
