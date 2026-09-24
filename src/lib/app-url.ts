/**
 * The app's public origin: NEXT_PUBLIC_APP_URL, the one address the
 * same-origin guard admits in production and the base of every redirect
 * and of the default WorkOS callback.
 *
 * Production never guesses it: an unset value throws, and the same-origin
 * guard refuses every state-changing request with a logged reason. Before
 * 24 Sep 2026 two copies of the fallback (here and in the WorkOS client)
 * said `http://localhost:3000` in every mode, so a production deployment
 * without the variable admitted a localhost origin and redirected to it,
 * and in development the fallback named a port `npm run dev` does not use
 * (it serves on 3002, as the README says).
 *
 * Read on every call, never at module load, so `next build` (the Docker
 * build has no NEXT_PUBLIC_APP_URL) and tests that stub the variable are
 * unaffected. Next.js still inlines a value that is set at build time, so
 * the origin is fixed per image; a server-only APP_URL read at runtime is
 * deferred (DECISIONS, 24 Sep). The Edge middleware reaches this module
 * through the same-origin guard, so it uses no Node APIs and is not
 * server-only.
 */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;

  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL must be set in production');
  }

  return 'http://localhost:3002';
}
