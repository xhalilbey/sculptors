'use client';

import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthProvider } from '@/contexts/auth-context';
import { OrganizationProvider } from '@/contexts/organization-context';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * App-wide provider wrapper: the WorkOS session (AuthProvider) and the
 * active organization (OrganizationProvider, fed by /api/organizations),
 * inside an ErrorBoundary, which logs what it catches itself.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <OrganizationProvider>
          {children}
        </OrganizationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
