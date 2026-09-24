import { describe, expect, it } from 'vitest';
import type { Pipeline } from '../domain/pipeline';
import { createBrowserPipelineStore } from './browser-pipeline-store';

function memoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

const SYNC: Pipeline = {
  id: 'sync_abc',
  kind: 'sync',
  name: 'Shopify catalog',
  data: ['products'],
  trigger: 'continuous',
  tags: ['catalog'],
  ownerId: 'user_me',
  runAs: 'Halil',
  favorite: false,
  createdAt: '2026-09-23T15:00:00.000Z',
};

describe('the browser pipeline store', () => {
  it('reads back its own organization list, the same array until it changes', () => {
    const storage = memoryStorage();
    const mine = createBrowserPipelineStore('org_01MINE', storage);
    const theirs = createBrowserPipelineStore('org_01THEIRS', storage);

    mine.save([SYNC]);

    expect(mine.load()).toEqual([SYNC]);
    expect(mine.load()).toBe(mine.load());
    expect(theirs.load()).toEqual([]);
  });

  it('reads an entry it cannot trust as an empty list', () => {
    const storage = memoryStorage();
    const store = createBrowserPipelineStore('org_01MINE', storage);

    storage.setItem('sculptors.pipelines.org_01MINE', JSON.stringify({ version: 1, items: [{ ...SYNC, trigger: 'yearly' }] }));

    expect(store.load()).toEqual([]);
  });
});
