import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/auth-context';

/**
 * The auth pages (/auth/*). Only the session provider: the login page shows
 * the loader until the session check answers and sends a signed-in visitor
 * into the app. Organizations are the dashboard's concern.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
