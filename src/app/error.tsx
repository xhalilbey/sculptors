'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorScene } from '@/components/errors/error-scene';
import { logger } from '@/lib/logger';

/**
 * A route that threw outside the dashboard. It says what happened in one
 * sentence and offers the two ways on: try the page again, or go home.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Route error', error, {
      digest: error.digest,
      url: window.location.href,
    });
  }, [error]);

  return (
    <ErrorScene
      code="500"
      eyebrow="Something went wrong"
      title="Something broke on our side."
      body="It is nothing you did. Try again; if it keeps happening, give it a few minutes."
      actions={
        <>
          <button type="button" onClick={reset} className="btn-brand">
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Back home
          </Link>
        </>
      }
    />
  );
}
