'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useOrganizations } from '@/contexts/organization-context';
import { createPipeline, deletePipeline, toggleFavorite, type CreateResult } from '../application/pipeline-actions';
import type { Pipeline, PipelineDraft } from '../domain/pipeline';
import { createBrowserPipelineStore } from '../infrastructure/browser-pipeline-store';

const NONE: readonly Pipeline[] = [];

/** A pipeline's id, made when it is created (never while rendering): its kind and twelve random hex digits. */
function newPipelineId(kind: Pipeline['kind']): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;

  return `${kind}_${random.slice(0, 12)}`;
}

/** The organization's pipelines and what can be done to them, as the signed-in member. */
export function usePipelines() {
  const { user } = useAuth();
  const { activeOrganization } = useOrganizations();
  const organizationId = activeOrganization?.id ?? 'none';
  const store = useMemo(() => createBrowserPipelineStore(organizationId), [organizationId]);
  const items = useSyncExternalStore(store.subscribe, store.load, () => NONE);
  const memberId = user?.id ?? 'me';
  const memberName = user?.displayName || 'You';

  const create = useCallback(
    (draft: PipelineDraft): CreateResult =>
      createPipeline(store, draft, { id: newPipelineId(draft.kind), ownerId: memberId, runAs: memberName, now: new Date() }),
    [store, memberId, memberName]
  );

  return {
    items,
    memberId,
    create,
    toggleFavorite: useCallback((id: string) => toggleFavorite(store, id), [store]),
    remove: useCallback((id: string) => deletePipeline(store, id), [store]),
  };
}
