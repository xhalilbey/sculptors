import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { completeSignIn, signInContextFrom, signInOptions } from '@/lib/auth/sign-in';
import { requireSameOrigin } from '@/lib/security/request-guards';
import { loginSchema } from '@/lib/validations';
import { getWorkOSClient, setWorkOSSessionCookie } from '@/lib/workos/auth';

/**
 * POST /api/auth/workos/password -- sign in with email and password. Parse,
 * hand the WorkOS call to completeSignIn (lib/auth/sign-in.ts), answer.
 */
export async function POST(request: NextRequest) {
  const originFailure = requireSameOrigin(request);

  if (originFailure) {
    return originFailure;
  }

  const parsedBody = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: 'A valid email and password are required.' },
      { status: 400 }
    );
  }

  const ctx = signInContextFrom(request.headers);
  const { email, password } = parsedBody.data;
  const result = await completeSignIn(
    () => getWorkOSClient().userManagement.authenticateWithPassword({ ...signInOptions(ctx), email, password }),
    ctx
  );

  switch (result.kind) {
    case 'signed-in': {
      const response = NextResponse.json({ success: true });

      setWorkOSSessionCookie(response, result.sealedSession);

      return response;
    }

    case 'verify-email':
      return NextResponse.json(
        {
          success: false,
          error: result.pendingAuthenticationToken
            ? 'Enter the verification code sent to your email.'
            : 'Please verify your email in WorkOS before signing in.',
          requiresEmailVerification: true,
          pendingAuthenticationToken: result.pendingAuthenticationToken,
        },
        { status: 403 }
      );

    // MFA and SSO requirements answer like a wrong password: the page has no
    // step for either, and naming them would tell a stranger the account's
    // configuration.
    case 'rejected':
      return NextResponse.json({ success: false, error: 'Incorrect email or password' }, { status: 401 });

    case 'forbidden':
      return NextResponse.json({ success: false, error: 'This WorkOS account is not allowed.' }, { status: 403 });

    case 'unavailable':
      return NextResponse.json(
        { success: false, error: 'Authentication succeeded, but the organization service is unavailable.' },
        { status: 503 }
      );
  }
}
