import { GenericServerException } from '@workos-inc/node';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticated, type signInMocks } from '@/test/sign-in-mocks';

/** The emailed-code step of a paused sign-in, through lib/auth/sign-in. */

const mocks = vi.hoisted(() => ({ current: undefined as ReturnType<typeof signInMocks> | undefined }));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/auth', async () => {
  const { signInMocks: create } = await import('@/test/sign-in-mocks');

  mocks.current = create();

  return mocks.current.module;
});

const { POST } = await import('./route');
const m = (() => {
  if (!mocks.current) throw new Error('lib/workos/auth mock did not load');

  return mocks.current;
})();

function post(
  body: unknown = { code: ' 123456 ', pendingAuthenticationToken: 'pending_1' },
  headers: Record<string, string> = {}
) {
  return POST(
    new NextRequest('http://localhost:3000/api/auth/workos/email-verification', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  for (const fn of Object.values(m.userManagement)) fn.mockReset();
  m.buildSessionContext.mockReset();
  m.buildSessionContext.mockResolvedValue({ context: {}, refreshedSessionData: undefined });
});

describe('POST /api/auth/workos/email-verification', () => {
  it('signs in with the trimmed code and the pending token', async () => {
    m.userManagement.authenticateWithEmailVerification.mockResolvedValue(authenticated('sealed-verified'));

    const response = await post();

    expect(response.status).toBe(200);
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-verified');
    expect(m.userManagement.authenticateWithEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({ code: '123456', pendingAuthenticationToken: 'pending_1' })
    );
  });

  it('answers 401 for a wrong or expired code', async () => {
    m.userManagement.authenticateWithEmailVerification.mockRejectedValue(
      new GenericServerException(400, 'Invalid code', { code: 'email_verification_code_invalid', message: 'Invalid code' }, 'req_1')
    );

    const response = await post();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'Invalid or expired verification code.' });
  });

  it('answers 503 when the session cannot be established after WorkOS accepted the code', async () => {
    m.userManagement.authenticateWithEmailVerification.mockResolvedValue(authenticated());
    m.buildSessionContext.mockRejectedValue(new Error('connection refused'));

    expect((await post()).status).toBe(503);
  });

  it('refuses a body over 64 KiB like a bad code, without calling workos', async () => {
    const response = await post({ code: '123456', pendingAuthenticationToken: 'p'.repeat(70 * 1024) });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'Invalid or expired verification code.' });
    expect(m.userManagement.authenticateWithEmailVerification).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON like a bad code, without calling workos', async () => {
    const response = await post(undefined, { 'content-type': 'text/plain' });

    expect(response.status).toBe(401);
    expect(m.userManagement.authenticateWithEmailVerification).not.toHaveBeenCalled();
  });

  it('refuses a foreign origin before calling workos', async () => {
    const response = await post(undefined, { origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(m.userManagement.authenticateWithEmailVerification).not.toHaveBeenCalled();
  });
});
