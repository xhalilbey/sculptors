import { describe, expect, it } from 'vitest';
import {
  draftProblems,
  emptyDraft,
  filterPipelines,
  NO_FILTERS,
  sortPipelines,
  tagsFrom,
  type Pipeline,
} from './pipeline';

function pipeline(overrides: Partial<Pipeline> & Pick<Pipeline, 'id' | 'name'>): Pipeline {
  return {
    kind: 'job',
    data: [],
    trigger: 'daily',
    tags: [],
    ownerId: 'user_me',
    runAs: 'Halil',
    favorite: false,
    createdAt: '2026-09-23T12:00:00.000Z',
    ...overrides,
  };
}

const ITEMS = [
  pipeline({ id: 'sync_aaa111', name: 'Shopify catalog', kind: 'sync', data: ['products'], tags: ['catalog'] }),
  pipeline({ id: 'job_bbb222', name: 'Nightly discovery pages', tags: ['nightly', 'pages'], favorite: true }),
  pipeline({ id: 'job_ccc333', name: 'avg order report', ownerId: 'user_other', runAs: 'Ayşe' }),
];

describe('tagsFrom', () => {
  it('keeps each tag once, trimmed and lower-case, in the order typed', () => {
    expect(tagsFrom(' Catalog, nightly ,, CATALOG, pages ')).toEqual(['catalog', 'nightly', 'pages']);
  });
});

describe('draftProblems', () => {
  it('asks a sync for a name and for what it keeps in step', () => {
    expect(draftProblems({ ...emptyDraft('sync'), data: [] })).toEqual({
      name: 'Give the sync a name.',
      data: 'Choose what the sync keeps in step.',
    });
  });

  it('never lets a job run continuously, and keeps tags few and short', () => {
    expect(draftProblems({ ...emptyDraft('job'), name: 'Report', trigger: 'continuous' }).trigger).toBeDefined();
    expect(draftProblems({ ...emptyDraft('job'), name: 'Report', tags: 'a, b, c, d, e, f' }).tags).toBe('Keep to 5 tags.');
    expect(draftProblems({ ...emptyDraft('job'), name: 'Report', tags: 'x'.repeat(25) }).tags).toMatch(/24 characters/);
    expect(draftProblems({ ...emptyDraft('job'), name: 'Report' })).toEqual({});
  });
});

describe('filterPipelines', () => {
  it('matches the name anywhere and the id from its start', () => {
    expect(filterPipelines(ITEMS, { ...NO_FILTERS, query: 'DISCOVERY' }, 'user_me').map((item) => item.id)).toEqual(['job_bbb222']);
    expect(filterPipelines(ITEMS, { ...NO_FILTERS, query: 'sync_a' }, 'user_me').map((item) => item.id)).toEqual(['sync_aaa111']);
  });

  it('narrows by kind, by whose they are, and by any of the chosen tags or runners', () => {
    const ids = (filters: Partial<typeof NO_FILTERS>) =>
      filterPipelines(ITEMS, { ...NO_FILTERS, ...filters }, 'user_me').map((item) => item.id);

    expect(ids({ kind: 'sync' })).toEqual(['sync_aaa111']);
    expect(ids({ scope: 'owned' })).toEqual(['sync_aaa111', 'job_bbb222']);
    expect(ids({ scope: 'favorites' })).toEqual(['job_bbb222']);
    expect(ids({ tags: ['catalog', 'pages'] })).toEqual(['sync_aaa111', 'job_bbb222']);
    expect(ids({ runAs: ['Ayşe'] })).toEqual(['job_ccc333']);
  });
});

describe('sortPipelines', () => {
  it('sorts by name whatever the case, either way', () => {
    expect(sortPipelines(ITEMS, 'asc').map((item) => item.name)).toEqual([
      'avg order report',
      'Nightly discovery pages',
      'Shopify catalog',
    ]);
    expect(sortPipelines(ITEMS, 'desc')[0]?.name).toBe('Shopify catalog');
  });
});
