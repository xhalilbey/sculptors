import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonBody } from '@/lib/api/read-json-body';
import { logger } from '@/lib/logger';
import { requireSameOrigin } from '@/lib/security/request-guards';
import { getWorkOSClient } from '@/lib/workos/auth';

/**
 * POST /api/auth/workos/password-reset -- ask WorkOS to email a reset link.
 * Every answer past the origin check is { success: true }: an unknown
 * address, a WorkOS failure and a body that is malformed, not JSON or over
 * the 64 KiB cap all look alike, so the route never tells a stranger whether
 * an account exists.
 */

const passwordResetSchema = z.object({
  email: z.email(),
});

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);

  if (originFailure) {
    return originFailure;
  }

  try {
    const body = passwordResetSchema.parse(await readJsonBody(request));

    await getWorkOSClient().userManagement.createPasswordReset({
      email: body.email.trim().toLowerCase(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.warn('WorkOS password reset request failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });

    // Avoid leaking whether the email exists in WorkOS.
    return NextResponse.json({ success: true });
  }
}
