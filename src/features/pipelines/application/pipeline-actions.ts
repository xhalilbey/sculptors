import { draftProblems, PIPELINE_LIMITS, tagsFrom, type DraftProblems, type Pipeline, type PipelineDraft } from '../domain/pipeline';
import type { PipelineStore } from './ports';

export type CreateResult = { ok: true; pipeline: Pipeline } | { ok: false; problems: DraftProblems };

/** Adds a sync or a job made from the draft, newest first, or says why it cannot. */
export function createPipeline(
  store: PipelineStore,
  draft: PipelineDraft,
  made: { id: string; ownerId: string; runAs: string; now: Date }
): CreateResult {
  const problems = draftProblems(draft);
  const items = store.load();

  if (items.length >= PIPELINE_LIMITS.items) problems.name = `An organization keeps at most ${PIPELINE_LIMITS.items} pipelines.`;
  if (Object.keys(problems).length > 0) return { ok: false, problems };

  const pipeline: Pipeline = {
    id: made.id,
    kind: draft.kind,
    name: draft.name.trim(),
    data: draft.kind === 'sync' ? [...draft.data] : [],
    trigger: draft.trigger,
    tags: tagsFrom(draft.tags),
    ownerId: made.ownerId,
    runAs: made.runAs,
    favorite: false,
    createdAt: made.now.toISOString(),
  };

  store.save([pipeline, ...items]);

  return { ok: true, pipeline };
}

export function toggleFavorite(store: PipelineStore, id: string): void {
  store.save(store.load().map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)));
}

export function deletePipeline(store: PipelineStore, id: string): void {
  store.save(store.load().filter((item) => item.id !== id));
}
