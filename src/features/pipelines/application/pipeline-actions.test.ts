import { describe, expect, it } from 'vitest';
import { emptyDraft, type Pipeline } from '../domain/pipeline';
import { createPipeline, deletePipeline, toggleFavorite } from './pipeline-actions';
import type { PipelineStore } from './ports';

function memoryStore(): PipelineStore {
  let items: readonly Pipeline[] = [];

  return {
    load: () => items,
    save: (next) => {
      items = next;
    },
    subscribe: () => () => {},
  };
}

const MADE = { ownerId: 'user_me', runAs: 'Halil', now: new Date('2026-09-23T15:00:00Z') };

describe('the pipeline actions', () => {
  it('create a sync from the draft, newest first, with its tags kept', () => {
    const store = memoryStore();

    createPipeline(store, { ...emptyDraft('job'), name: 'Report' }, { ...MADE, id: 'job_1' });
    const result = createPipeline(
      store,
      { ...emptyDraft('sync'), name: '  Shopify catalog ', data: ['products', 'orders'], tags: 'Catalog' },
      { ...MADE, id: 'sync_1' }
    );

    expect(result.ok).toBe(true);
    expect(store.load().map((item) => item.id)).toEqual(['sync_1', 'job_1']);
    expect(store.load()[0]).toMatchObject({
      name: 'Shopify catalog',
      data: ['products', 'orders'],
      trigger: 'continuous',
      tags: ['catalog'],
      runAs: 'Halil',
      favorite: false,
      createdAt: '2026-09-23T15:00:00.000Z',
    });
  });

  it('keep nothing from a draft with problems', () => {
    const store = memoryStore();

    expect(createPipeline(store, emptyDraft('job'), { ...MADE, id: 'job_1' })).toEqual({
      ok: false,
      problems: { name: 'Give the job a name.' },
    });
    expect(store.load()).toEqual([]);
  });

  it('star and delete one pipeline without touching the others', () => {
    const store = memoryStore();

    createPipeline(store, { ...emptyDraft('job'), name: 'A' }, { ...MADE, id: 'job_a' });
    createPipeline(store, { ...emptyDraft('job'), name: 'B' }, { ...MADE, id: 'job_b' });
    toggleFavorite(store, 'job_a');

    expect(store.load().find((item) => item.id === 'job_a')?.favorite).toBe(true);
    expect(store.load().find((item) => item.id === 'job_b')?.favorite).toBe(false);

    deletePipeline(store, 'job_a');

    expect(store.load().map((item) => item.id)).toEqual(['job_b']);
  });
});
