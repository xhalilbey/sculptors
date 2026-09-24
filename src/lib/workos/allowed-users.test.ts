import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The sign-in allow-list is the single control standing between one customer
 * and many. Its failure direction matters more than its happy path: an unset
 * or empty value must deny everyone, never admit everyone.
 */

vi.mock('@/lib/identity', () => ({}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { getAllowedWorkOSUserIds } = await import('./auth');

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('getAllowedWorkOSUserIds', () => {
  it('is empty when nothing is configured', () => {
    delete process.env.SCULPTORS_ALLOWED_WORKOS_USER_IDS;
    delete process.env.SCULPTORS_OWNER_WORKOS_USER_ID;

    expect(getAllowedWorkOSUserIds()).toEqual([]);
  });

  it('is empty for a blank value rather than admitting a blank id', () => {
    process.env.SCULPTORS_ALLOWED_WORKOS_USER_IDS = '  , ,,  ';
    delete process.env.SCULPTORS_OWNER_WORKOS_USER_ID;

    expect(getAllowedWorkOSUserIds()).toEqual([]);
  });

  it('still honours the original single-owner variable', () => {
    delete process.env.SCULPTORS_ALLOWED_WORKOS_USER_IDS;
    process.env.SCULPTORS_OWNER_WORKOS_USER_ID = 'user_legacy';

    expect(getAllowedWorkOSUserIds()).toEqual(['user_legacy']);
  });

  it('parses a comma-separated list and trims padding', () => {
    process.env.SCULPTORS_ALLOWED_WORKOS_USER_IDS = ' user_a , user_b,user_c ';
    delete process.env.SCULPTORS_OWNER_WORKOS_USER_ID;

    expect(getAllowedWorkOSUserIds()).toEqual(['user_a', 'user_b', 'user_c']);
  });

  it('merges both variables and de-duplicates', () => {
    process.env.SCULPTORS_ALLOWED_WORKOS_USER_IDS = 'user_a,user_b';
    process.env.SCULPTORS_OWNER_WORKOS_USER_ID = 'user_a';

    expect(getAllowedWorkOSUserIds()).toEqual(['user_a', 'user_b']);
  });
});
