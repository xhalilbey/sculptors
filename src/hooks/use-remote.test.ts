import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiRequestError } from '@/lib/clients/api-error';

/**
 * What a failed remote request shows, and what it leaves in the log. The
 * three hooks useRemote replaced mapped anything that was not an
 * ApiRequestError to the generic line and logged nothing, so a response
 * that had drifted from its schema failed without a trace. The hook itself
 * is not rendered here: the unit project runs in node, without a DOM for
 * its effects to run in.
 */

const logError = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { error: logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { messageOf } = await import('./use-remote');

describe('messageOf', () => {
  beforeEach(() => {
    logError.mockClear();
  });

  it("shows our api's own message and logs nothing", () => {
    const refusal = new ApiRequestError('You do not have access to this organization', 403);

    expect(messageOf(refusal)).toBe('You do not have access to this organization');
    expect(logError).not.toHaveBeenCalled();
  });

  it('logs a response that no longer matches its schema and shows the generic line', () => {
    const drift = z.object({ orders: z.array(z.string()) }).safeParse({ orders: 'none' }).error;

    expect(drift).toBeInstanceOf(z.ZodError);
    expect(messageOf(drift)).toBe('Something went wrong. Please try again.');
    expect(logError).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith('Remote request failed', drift);
  });

  it('logs a request that never reached the server', () => {
    const offline = new TypeError('Failed to fetch');

    expect(messageOf(offline)).toBe('Something went wrong. Please try again.');
    expect(logError).toHaveBeenCalledWith('Remote request failed', offline);
  });
});
