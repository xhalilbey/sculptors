import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonBody } from '@/lib/api/read-json-body';
import { completeSignIn, signInContextFrom, signInOptions } from '@/lib/auth/sign-in';
import { requireSameOrigin } from '@/lib/security/request-guards';
import { getWorkOSClient, setWorkOSSessionCookie } from '@/lib/workos/auth';

/**
 * POST /api/auth/workos/email-verification -- finish a sign-in WorkOS paused
 * for email verification, with the emailed code and the pending token the
 * password step returned.
 */

const emailVerificationSchema = z.object({
  code: z.string().min(4).max(12),
  pendingAuthenticationToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);

  if (originFailure) {
    return originFailure;
  }

  // A body the shared reader refuses (not JSON, over 64 KiB) is answered
  // like a bad code.
  const parsedBody = emailVerificationSchema.safeParse(await readJsonBody(request).catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired verification code.' },
      { status: 401 }
    );
  }

  const ctx = signInContextFrom(request.headers);
  const { code, pendingAuthenticationToken } = parsedBody.data;
  const result = await completeSignIn(
    () =>
      getWorkOSClient().userManagement.authenticateWithEmailVerification({
        ...signInOptions(ctx),
        code: code.trim(),
        pendingAuthenticationToken,
      }),
    ctx,
    { invalid: 'invalid_code' }
  );

  switch (result.kind) {
    case 'signed-in': {
      const response = NextResponse.json({ success: true });

      setWorkOSSessionCookie(response, result.sealedSession);

      return response;
    }

    case 'forbidden':
      return NextResponse.json({ success: false, error: 'This WorkOS account is not allowed.' }, { status: 403 });

    case 'unavailable':
      return NextResponse.json(
        { success: false, error: 'Authentication succeeded, but the organization service is unavailable.' },
        { status: 503 }
      );

    // A second verification request, MFA or SSO: none has a step here.
    case 'verify-email':
    case 'rejected':
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification code.' },
        { status: 401 }
      );
  }
}
