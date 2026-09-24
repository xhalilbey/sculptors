'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as organizationsClient from '@/lib/clients/organizations.client';
import { logger } from '@/lib/logger';
import type { OrganizationDto } from '@/types/api';
import { useAuth } from './auth-context';

interface OrganizationContextType {
  /** The organization the session is bound to (from /api/auth/me). */
  activeOrganization: OrganizationDto | null;
  /** Every organization of the user, in the server's switcher order. */
  organizations: OrganizationDto[];
  loading: boolean;
  /**
   * Create an organization. The server also switches the session into it,
   * so success reloads the page on it; the promise then never settles.
   * Resolves to the message to show when creation failed.
   */
  createOrganization: (name: string) => Promise<string | null>;
  /**
   * Ask the server to re-issue the session for another organization, then
   * reload so every page reads the new tenant. Resolves to false when the
   * server refused; on success the page reloads.
   */
  selectOrganization: (organizationId: string) => Promise<boolean>;
  /** Re-read the session and the list, after a change that did not reload. */
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

/*
 * The active organization is inside the sealed WorkOS session; the server
 * already knows it, so nothing here remembers a selection of its own (v1
 * kept one in localStorage and replayed it on every load).
 */
export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, organization: activeOrganization, loading, refreshUser } = useAuth();
  // null once the list failed to load; the value below then offers the
  // active organization on its own.
  const [organizations, setOrganizations] = useState<OrganizationDto[] | null>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const userId = user?.id;
  const activeOrganizationId = activeOrganization?.id;

  // Keyed on ids, not on the user and organization objects. Every
  // /api/auth/me answer is a fresh object, so keying on them made the effect
  // below reload the list after each refreshUser, while refreshOrganizations
  // loaded it a second time through the closure it held from before. Now the
  // effect reloads only for a different user or a different organization,
  // and refreshOrganizations does the one load a refresh needs.
  const loadOrganizations = useCallback(async () => {
    if (!userId) {
      setOrganizations([]);
      setOrganizationsLoading(false);

      return;
    }

    setOrganizationsLoading(true);

    try {
      setOrganizations(await organizationsClient.listOrganizations());
    } catch (error) {
      logger.warn('Failed to load organization list', {
        error: error instanceof Error ? error.message : String(error),
      });
      setOrganizations(null);
    }

    setOrganizationsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // A tick later, not in the effect body: loadOrganizations sets state at
    // once, which react-hooks/set-state-in-effect refuses there. Clearing
    // the timer also drops a load that a re-run makes redundant, such as
    // Strict Mode's second pass in development.
    const timeoutId = window.setTimeout(() => {
      void loadOrganizations();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeOrganizationId, loadOrganizations, userId]);

  const createOrganization = useCallback(async (name: string) => {
    try {
      const created = await organizationsClient.createOrganization({ name });

      logger.info('Organization created', { organizationId: created.id });
    } catch (error) {
      logger.error('Failed to create organization', error);

      return error instanceof organizationsClient.ApiRequestError
        ? error.message
        : 'The organization could not be created.';
    }

    window.location.reload();

    return null;
  }, []);

  const selectOrganization = useCallback(
    async (organizationId: string) => {
      if (organizationId === activeOrganization?.id) {
        return true;
      }

      try {
        await organizationsClient.selectOrganization(organizationId);
      } catch (error) {
        logger.warn('Failed to select organization', {
          organizationId,
          error: error instanceof Error ? error.message : String(error),
        });

        return false;
      }

      window.location.reload();

      return true;
    },
    [activeOrganization?.id]
  );

  const refreshOrganizations = useCallback(async () => {
    await refreshUser();
    await loadOrganizations();
  }, [loadOrganizations, refreshUser]);

  const value = useMemo(
    () => ({
      activeOrganization: user ? activeOrganization : null,
      organizations: user
        ? (organizations ?? (activeOrganization ? [activeOrganization] : []))
        : [],
      loading: loading || organizationsLoading,
      createOrganization,
      selectOrganization,
      refreshOrganizations,
    }),
    [
      activeOrganization,
      createOrganization,
      loading,
      organizations,
      organizationsLoading,
      refreshOrganizations,
      selectOrganization,
      user,
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizations() {
  const context = useContext(OrganizationContext);

  if (context === undefined) {
    throw new Error('useOrganizations must be used within an OrganizationProvider');
  }

  return context;
}
