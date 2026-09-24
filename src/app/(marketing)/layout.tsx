import type { ReactNode } from 'react';

/**
 * The public marketing pages (the landing page at /). No providers: nothing
 * here reads the session, so an anonymous visit makes no /api/auth/me call.
 * A visitor with a session cookie never gets here -- the proxy
 * (src/middleware.ts) redirects them into the app.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return children;
}
