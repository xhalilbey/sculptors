'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSession } from '@/lib/clients/session.client';
import { logger } from '@/lib/logger';
import type { OrganizationDto, SessionUserDto } from '@/types/api';

interface AuthContextType {
  user: SessionUserDto | null;
  /** The organization the session is bound to. */
  organization: OrganizationDto | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let authMeRequest: ReturnType<typeof fetchSession> | null = null;

/** One /api/auth/me in flight at a time, however many providers ask. */
function requestAuthMe(): ReturnType<typeof fetchSession> {
  if (authMeRequest) {
    return authMeRequest;
  }

  authMeRequest = fetchSession().finally(() => {
    authMeRequest = null;
  });

  return authMeRequest;
}

function isAuthPage() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/auth');
}

function isBrandingPage() {
  return typeof window !== 'undefined' && window.location.pathname === '/';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUserDto | null>(null);
  const [organization, setOrganization] = useState<OrganizationDto | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const response = await requestAuthMe();

      if (response.status < 200 || response.status >= 300) {
        logger.debug('No valid WorkOS session found', { status: response.status });
        setUser(null);
        setOrganization(null);

        // 403 is an account that may not use the app (suspended, or outside
        // the allowlist): signed out, like an expired session.
        if ((response.status === 401 || response.status === 403) && !isAuthPage() && !isBrandingPage()) {
          window.location.replace('/api/auth/logout');
        }

        return;
      }

      const session = response.session;

      if (!session) {
        setUser(null);
        setOrganization(null);

        return;
      }

      setUser(session.user);
      setOrganization(session.organization);
      logger.auth('WorkOS authentication check completed', {
        userId: session.user.id,
        organizationId: session.organization.id,
      });
    } catch (error) {
      logger.error('Error loading WorkOS user', error);
      setUser(null);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const handleCrossTabLogout = () => {
      if (!isMounted) return;

      logger.info('Logout detected from another tab, clearing local state');
      setUser(null);
      setOrganization(null);
      setLoading(false);
      window.location.replace('/api/auth/logout');
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'auth-logout-event' && event.newValue) {
        handleCrossTabLogout();
      }
    };

    const initialize = async () => {
      await loadUser();

      if (!isMounted) return;

      window.addEventListener('storage', handleStorageChange);
    };

    initialize();

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadUser]);

  const signOut = useCallback(async () => {
    try {
      try {
        const timestamp = Date.now().toString();

        localStorage.setItem('auth-logout-event', timestamp);
        setTimeout(() => {
          localStorage.removeItem('auth-logout-event');
        }, 1000);
      } catch (error) {
        logger.warn('Failed to set logout event in localStorage', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      setUser(null);
      setOrganization(null);
      setLoading(false);

      window.location.assign('/api/auth/logout');
      await new Promise<void>(() => {});
    } catch (error) {
      logger.error('Error during WorkOS sign out', error);
      setUser(null);
      setOrganization(null);
      setLoading(false);
      window.location.assign('/api/auth/logout');
      await new Promise<void>(() => {});
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const value = useMemo(
    () => ({ user, organization, loading, signOut, refreshUser }),
    [loading, organization, refreshUser, signOut, user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
