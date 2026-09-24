import { GenericServerException } from '@workos-inc/node';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The forgotten-password request. Past the origin check every answer is
 * { success: true }: an unknown address, a WorkOS failure and a body that is
 * malformed, not JSON or over the 64 KiB cap must look alike, so the route
 * never tells a stranger whether an account exists. The body goes through
 * the shared reader (lib/api/read-json-body.ts), so a refused body never
 * reaches WorkOS.
 */

const createPasswordReset = vi.fn();
const warn = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/auth', () => ({
  getWorkOSClient: () => ({ userManagement: { createPasswordReset } }),
}));

const { POST } = await import('./route');

function post(body: unknown = { email: 'Ada@Example.COM' }, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest('http://localhost:3000/api/auth/workos/password-reset', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

async function expectSuccess(response: Response) {
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
}

beforeEach(() => {
  createPasswordReset.mockReset();
  warn.mockReset();
  createPasswordReset.mockResolvedValue({ id: 'password_reset_1' });
});

describe('POST /api/auth/workos/password-reset', () => {
  it('asks workos to email the lower-cased address', async () => {
    await expectSuccess(await post());

    expect(createPasswordReset).toHaveBeenCalledWith({ email: 'ada@example.com' });
  });

  it('answers success when workos rejects an unknown address, logging no address', async () => {
    createPasswordReset.mockRejectedValue(
      new GenericServerException(404, 'User not found', { code: 'entity_not_found', message: 'User not found' }, 'req_1')
    );

    await expectSuccess(await post());

    expect(warn).toHaveBeenCalledWith('WorkOS password reset request failed', { errorType: 'GenericServerException' });
  });

  it('answers success without calling workos for a malformed email', async () => {
    await expectSuccess(await post({ email: 'not-an-email' }));

    expect(createPasswordReset).not.toHaveBeenCalled();
  });

  it('answers success without calling workos for a body over 64 KiB', async () => {
    // The size lives in the email itself, a field the schema accepts: z.email() sets no length
    // limit, so only the cap keeps this address from WorkOS. An unknown padding key would be
    // refused anyway once the schema is strict, and the test would stop pinning the cap.
    await expectSuccess(await post({ email: `${'a'.repeat(70 * 1024)}@example.com` }));

    expect(createPasswordReset).not.toHaveBeenCalled();
  });

  it('answers success without calling workos for a body that is not JSON', async () => {
    await expectSuccess(await post(undefined, { 'content-type': 'text/plain' }));

    expect(createPasswordReset).not.toHaveBeenCalled();
  });

  it('refuses a foreign origin before calling workos', async () => {
    const response = await post(undefined, { origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(createPasswordReset).not.toHaveBeenCalled();
  });
});
