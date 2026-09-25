import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/clients/api-error';
import type * as OrganizationsClient from '@/lib/clients/organizations.client';

/**
 * What a switch of organization tells its caller. It used to resolve to
 * false on a refusal, which the Settings screen never read, so a refused
 * switch was a click that did nothing. It now resolves like
 * createOrganization: null when there is nothing to show (the switch went
 * through and the page reloads, or the session is already there), otherwise
 * the server's message, or a fallback when no answer came. The provider is
 * rendered on the server, where no effect runs, and its value is called
 * directly.
 */

const selectOrganization = vi.fn();
const reload = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/clients/organizations.client', async importOriginal => ({
  ...(await importOriginal<typeof OrganizationsClient>()),
  selectOrganization,
}));
vi.mock('./auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user_1' },
    organization: { id: 'org_A', name: 'Acme', role: 'owner' },
    loading: false,
    refreshUser: vi.fn(),
  }),
}));

const { OrganizationProvider, useOrganizations } = await import('./organization-context');

type OrganizationContextValue = ReturnType<typeof useOrganizations>;

function Capture({ onValue }: { onValue: (value: OrganizationContextValue) => void }) {
  onValue(useOrganizations());

  return null;
}

function providedValue(): OrganizationContextValue {
  const values: OrganizationContextValue[] = [];

  renderToStaticMarkup(
    <OrganizationProvider>
      <Capture onValue={value => values.push(value)} />
    </OrganizationProvider>
  );

  const [value] = values;

  if (!value) throw new Error('OrganizationProvider provided no value');

  return value;
}

beforeEach(() => {
  selectOrganization.mockReset();
  reload.mockReset();
  vi.stubGlobal('window', { location: { reload } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('selectOrganization', () => {
  it('resolves to the server message on a refusal and stays on the page', async () => {
    selectOrganization.mockRejectedValue(
      new ApiRequestError('You do not have access to this organization', 403)
    );

    await expect(providedValue().selectOrganization('org_B')).resolves.toBe(
      'You do not have access to this organization'
    );
    expect(selectOrganization).toHaveBeenCalledWith('org_B');
    expect(reload).not.toHaveBeenCalled();
  });

  it('resolves to a fallback, not the raw error, when no answer came', async () => {
    selectOrganization.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(providedValue().selectOrganization('org_B')).resolves.toBe(
      'Could not switch organization. Please try again.'
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('resolves to null and reloads when the switch went through', async () => {
    selectOrganization.mockResolvedValue(undefined);

    await expect(providedValue().selectOrganization('org_B')).resolves.toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('resolves to null without a request for the organization already active', async () => {
    await expect(providedValue().selectOrganization('org_A')).resolves.toBeNull();
    expect(selectOrganization).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
