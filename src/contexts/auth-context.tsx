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
  /**
   * Tell the other tabs, clear the local session and navigate to
   * /api/auth/logout. The page is leaving, so the promise never settles:
   * a caller that awaits it keeps its pending state until the page goes.
   */
  signOut: () => Promise<never>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** The localStorage key signOut writes and every other tab listens for. */
const LOGOUT_EVENT_KEY = 'auth-logout-event';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUserDto | null>(null);
  const [organization, setOrganization] = useState<OrganizationDto | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const response = await requestAuthMe();

      if (!response.ok) {
        logger.debug('No valid WorkOS session found', { status: response.status });
        setUser(null);
        setOrganization(null);

        // 403 is an account that may not use the app (suspended, or outside
        // the allowlist): signed out, like an expired session. The landing
        // page at / used to be excluded here too, but it mounts no providers
        // ((marketing)/layout.tsx), so this never runs there.
        if ((response.status === 401 || response.status === 403) && !isAuthPage()) {
          window.location.replace('/api/auth/logout');
        }

        return;
      }

      const { session } = response;

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
      if (event.key === LOGOUT_EVENT_KEY && event.newValue) {
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

  // This used to sit inside a second try whose catch repeated the whole
  // body. Only the storage write can throw (a private window, a full
  // quota), and it has its own catch: a failure there costs the other tabs
  // their notice, and this tab still leaves.
  const signOut = useCallback(async (): Promise<never> => {
    try {
      const timestamp = Date.now().toString();

      localStorage.setItem(LOGOUT_EVENT_KEY, timestamp);
      setTimeout(() => {
        localStorage.removeItem(LOGOUT_EVENT_KEY);
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

    return new Promise<never>(() => {});
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
