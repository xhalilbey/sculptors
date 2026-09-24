import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { requireSameOrigin } from '@/lib/security/request-guards';
import { getWorkOSClient } from '@/lib/workos/auth';

const passwordResetSchema = z.object({
  email: z.email(),
});

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);

  if (originFailure) {
    return originFailure;
  }

  try {
    const body = passwordResetSchema.parse(await request.json());

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
