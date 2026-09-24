'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError } from '@/lib/clients/api-error';

export interface Remote<T> {
  /** The latest answer; while the next request runs, still the previous one. */
  data: T | null;
  error: string | null;
  retry: () => void;
}

/**
 * One request, again on `pollMs` if given (the orders board), and on retry.
 * The previous answer stays on screen while the next one loads; a request
 * that is overtaken is aborted.
 */
export function useRemote<T>(load: (signal: AbortSignal) => Promise<T>, pollMs?: number): Remote<T> {
  const [round, setRound] = useState(0);
  const [settled, setSettled] = useState<{ round: number; data: T | null; error: string | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal).then(
      (data) => setSettled({ round, data, error: null }),
      (error: unknown) => {
        if (controller.signal.aborted) return;

        setSettled((previous) => ({
          round,
          data: previous?.data ?? null,
          error: error instanceof ApiRequestError ? error.message : 'Something went wrong. Please try again.',
        }));
      }
    );

    return () => controller.abort();
  }, [round, load]);

  useEffect(() => {
    if (!pollMs) return;

    const timer = window.setInterval(() => setRound((current) => current + 1), pollMs);

    return () => window.clearInterval(timer);
  }, [pollMs]);

  const retry = useCallback(() => setRound((current) => current + 1), []);

  return { data: settled?.data ?? null, error: settled?.round === round ? settled.error : null, retry };
}
