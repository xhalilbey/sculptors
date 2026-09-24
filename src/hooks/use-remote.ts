'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError } from '@/lib/clients/api-error';
import { logger } from '@/lib/logger';

/**
 * A request's answer as a screen reads it. Until 24 Sep 2026 this hook was
 * written three times: metrics had a keyed useRemote with a loading flag,
 * commerce a polling useRemote without one (the same names, a different
 * contract), and System Health its own useHealthReport.
 */
export interface Remote<T> {
  /** The latest answer; while the next request runs, and after it fails, still the previous one. */
  data: T | null;
  /** Why the current request failed, as the user reads it; null while it runs. */
  error: string | null;
  /** True until the current key and attempt have settled. */
  loading: boolean;
  retry: () => void;
}

interface Settled<T> {
  round: string;
  data: T | null;
  error: string | null;
}

/**
 * What the user reads when a request fails: our API's own (already
 * sanitized) message, else a generic line. Anything that is not an
 * ApiRequestError -- a response that no longer matches its schema, a
 * network failure, a bug -- is logged first. The three copies this hook
 * replaced showed the generic line and logged nothing, so a contract drift
 * between server and browser left no trace.
 */
export function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;

  logger.error('Remote request failed', error);

  return 'Something went wrong. Please try again.';
}

/**
 * One request per key and attempt: again when `key` changes, on retry, and
 * every `pollMs` if given (the orders board). The previous answer stays on
 * screen while the next one loads and after it fails (the metrics pages dim
 * it rather than blanking), and a request that is overtaken is aborted and
 * ignored, whether it then fails or succeeds.
 *
 * `load` must be stable: a module function, or useCallback on the key's
 * parts. A new `load` on every render would request on every render.
 */
export function useRemote<T>(
  load: (signal: AbortSignal) => Promise<T>,
  { key = '', pollMs }: { key?: string; pollMs?: number } = {}
): Remote<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const round = `${key}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;

        setSettled({ round, data, error: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;

        // Mapped (and logged) here, not in the updater, which React may call twice.
        const message = messageOf(error);

        setSettled((previous) => ({ round, data: previous?.data ?? null, error: message }));
      }
    );

    return () => controller.abort();
  }, [round, load]);

  useEffect(() => {
    if (!pollMs) return;

    const timer = window.setInterval(() => setAttempt((count) => count + 1), pollMs);

    return () => window.clearInterval(timer);
  }, [pollMs]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return {
    data: settled?.data ?? null,
    error: settled?.round === round ? settled.error : null,
    loading: settled?.round !== round,
    retry,
  };
}
