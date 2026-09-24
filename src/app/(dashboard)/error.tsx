'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorScene } from '@/components/errors/error-scene';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { logger } from '@/lib/logger';

/**
 * Dashboard-level error boundary.
 *
 * Without one, a throw in any dashboard page escaped to the global error page
 * and unmounted the whole shell — the sidebar, the organization switcher, the
 * way back. Keeping the failure inside the segment means one broken panel
 * costs one panel: the error scene fills the content panel and the rail stays.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const theme = useDashboardTheme();

  useEffect(() => {
    logger.error('Dashboard segment failed', { digest: error.digest });
  }, [error]);

  return (
    <ErrorScene
      fill="container"
      tone={theme}
      code="500"
      eyebrow="This page failed"
      title="This page didn't load."
      body="The problem is limited to this page; the rest of the app keeps working. Try again, or come back in a few minutes."
      actions={
        <>
          <button type="button" onClick={reset} className="btn-brand">
            Try again
          </button>
          <Link href="/dashboard" className="btn-ghost">
            Store Events Panel
          </Link>
        </>
      }
    />
  );
}
