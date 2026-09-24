/**
 * Pipelines: what keeps a store's data moving (owner's direction, 23 Sep
 * 2026). A sync keeps Sculptors in step with the store's own products,
 * customers or orders; a job runs a task on a trigger. The page lists them
 * the way data platforms list their jobs and pipelines; the owner will
 * shape what each one does in a later conversation.
 */

export const PIPELINE_KINDS = ['sync', 'job'] as const;

export type PipelineKind = (typeof PIPELINE_KINDS)[number];

export const KIND_LABELS: Record<PipelineKind, string> = { sync: 'Sync', job: 'Job' };

export const SYNC_DATA = ['products', 'customers', 'orders'] as const;

export type SyncData = (typeof SYNC_DATA)[number];

export const SYNC_DATA_LABELS: Record<SyncData, string> = { products: 'Products', customers: 'Customers', orders: 'Orders' };

export const TRIGGERS = ['continuous', 'hourly', 'daily', 'weekly', 'manual'] as const;

export type Trigger = (typeof TRIGGERS)[number];

export const TRIGGER_LABELS: Record<Trigger, string> = {
  continuous: 'Continuous',
  hourly: 'Every hour',
  daily: 'Every day',
  weekly: 'Every week',
  manual: 'Manual',
};

/** A job runs and ends, so it is never continuous; a sync can follow its source as it changes. */
export const KIND_TRIGGERS: Record<PipelineKind, readonly Trigger[]> = {
  sync: TRIGGERS,
  job: ['hourly', 'daily', 'weekly', 'manual'],
};

export interface Pipeline {
  id: string;
  kind: PipelineKind;
  name: string;
  /** What a sync keeps in step; empty for a job. */
  data: SyncData[];
  trigger: Trigger;
  tags: string[];
  /** The member who made it. */
  ownerId: string;
  /** Whose rights it runs with, by name. */
  runAs: string;
  favorite: boolean;
  /** ISO instant. */
  createdAt: string;
}

export const PIPELINE_LIMITS = { name: 60, tags: 5, tag: 24, items: 200 } as const;

export interface PipelineDraft {
  kind: PipelineKind;
  name: string;
  data: SyncData[];
  trigger: Trigger;
  /** As typed: comma-separated. */
  tags: string;
}

export function emptyDraft(kind: PipelineKind): PipelineDraft {
  return { kind, name: '', data: kind === 'sync' ? ['products'] : [], trigger: kind === 'sync' ? 'continuous' : 'daily', tags: '' };
}

/** Tags as kept: trimmed, lower-case, each once, in the order typed. */
export function tagsFrom(text: string): string[] {
  return [...new Set(text.split(',').map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0))];
}

export type DraftProblems = Partial<Record<'name' | 'data' | 'trigger' | 'tags', string>>;

export function draftProblems(draft: PipelineDraft): DraftProblems {
  const problems: DraftProblems = {};
  const name = draft.name.trim();
  const tags = tagsFrom(draft.tags);

  if (name.length === 0) problems.name = draft.kind === 'sync' ? 'Give the sync a name.' : 'Give the job a name.';
  else if (name.length > PIPELINE_LIMITS.name) problems.name = `Keep the name to ${PIPELINE_LIMITS.name} characters.`;

  if (draft.kind === 'sync' && draft.data.length === 0) problems.data = 'Choose what the sync keeps in step.';

  if (!KIND_TRIGGERS[draft.kind].includes(draft.trigger)) problems.trigger = 'A job cannot run continuously.';

  if (tags.length > PIPELINE_LIMITS.tags) problems.tags = `Keep to ${PIPELINE_LIMITS.tags} tags.`;
  else if (tags.some((tag) => tag.length > PIPELINE_LIMITS.tag)) problems.tags = `Keep each tag to ${PIPELINE_LIMITS.tag} characters.`;

  return problems;
}

export type KindFilter = 'all' | PipelineKind;
export type ScopeFilter = 'owned' | 'accessible' | 'favorites';
export type SortDirection = 'asc' | 'desc';

export interface PipelineFilters {
  query: string;
  kind: KindFilter;
  scope: ScopeFilter;
  /** Any of them; none selected means no tag filter. */
  tags: readonly string[];
  /** Any of them; none selected means no filter. */
  runAs: readonly string[];
}

export const NO_FILTERS: PipelineFilters = { query: '', kind: 'all', scope: 'accessible', tags: [], runAs: [] };

export function filterPipelines(items: readonly Pipeline[], filters: PipelineFilters, memberId: string): Pipeline[] {
  const query = filters.query.trim().toLowerCase();

  return items.filter(
    (item) =>
      (query.length === 0 || item.name.toLowerCase().includes(query) || item.id.toLowerCase().startsWith(query)) &&
      (filters.kind === 'all' || item.kind === filters.kind) &&
      (filters.scope !== 'owned' || item.ownerId === memberId) &&
      (filters.scope !== 'favorites' || item.favorite) &&
      (filters.tags.length === 0 || item.tags.some((tag) => filters.tags.includes(tag))) &&
      (filters.runAs.length === 0 || filters.runAs.includes(item.runAs))
  );
}

export function sortPipelines(items: readonly Pipeline[], direction: SortDirection): Pipeline[] {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  return direction === 'asc' ? sorted : sorted.reverse();
}
