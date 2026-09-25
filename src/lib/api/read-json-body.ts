import 'server-only';

import type { NextRequest } from 'next/server';
import { AppError, ValidationError } from '@/types/errors';

/**
 * The one way a route reads a JSON request body. It lived inside
 * define-route.ts, so defineRoute and definePublicRoute were capped while the
 * three hand-written pre-session routes (POST /api/auth/workos/{password,
 * email-verification,password-reset}) called `request.json()`, which reads
 * whatever an unauthenticated caller streams, of any type and any size.
 * Those routes cannot use defineRoute (it requires a session), so the reader
 * moved here and all of them share it.
 */

/** The largest JSON body any route reads. Our payloads are a few hundred bytes. */
export const MAX_BODY_BYTES = 64 * 1024;

function isJsonContentType(value: string | null): boolean {
  return value !== null && /^application\/json\s*(;|$)/i.test(value);
}

/**
 * Reads a JSON body without trusting the caller about its size: a declared
 * Content-Length over the cap is refused before reading, and the stream is
 * cut off at the cap whatever the header said (it can be absent or wrong).
 * Throws AppError 415 for another Content-Type, AppError 413 over the cap and
 * ValidationError (400) for text that is not JSON.
 */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    throw new AppError('Content-Type must be application/json', 'UNSUPPORTED_MEDIA_TYPE', 415);
  }

  const declared = Number(request.headers.get('content-length'));

  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new AppError('Request body is too large', 'PAYLOAD_TOO_LARGE', 413);
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  if (request.body) {
    const reader = request.body.getReader();

    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;

      received += value.byteLength;

      if (received > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AppError('Request body is too large', 'PAYLOAD_TOO_LARGE', 413);
      }

      chunks.push(value);
    }
  }

  const text = new TextDecoder().decode(Buffer.concat(chunks));

  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
}
