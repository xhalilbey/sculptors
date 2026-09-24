import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_PROFILE } from '../domain/agent-profile';
import { createBrowserAgentProfileStore } from './browser-agent-profile-store';

/** A Storage in memory; `blocked` makes it refuse like a private window's. */
function memoryStorage({ blocked = false } = {}): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => {
      if (blocked) throw new Error('SecurityError');

      return entries.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (blocked) throw new Error('QuotaExceededError');

      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

describe('the browser agent profile store', () => {
  it('reads back what it kept, for its own organization only', () => {
    const storage = memoryStorage();
    const mine = createBrowserAgentProfileStore('org_01MINE', storage);
    const theirs = createBrowserAgentProfileStore('org_01THEIRS', storage);
    const profile = { ...DEFAULT_AGENT_PROFILE, name: 'Juniper' };

    expect(mine.load()).toBeNull();

    mine.save(profile);

    expect(mine.load()).toEqual(profile);
    expect(theirs.load()).toBeNull();
  });

  it('hands out the same object until the entry changes', () => {
    const store = createBrowserAgentProfileStore('org_01MINE', memoryStorage());

    store.save(DEFAULT_AGENT_PROFILE);
    const first = store.load();

    expect(store.load()).toBe(first);

    store.save({ ...DEFAULT_AGENT_PROFILE, name: 'Juniper' });

    expect(store.load()).not.toBe(first);
  });

  it('reads an entry it cannot trust as no profile', () => {
    const storage = memoryStorage();
    const store = createBrowserAgentProfileStore('org_01MINE', storage);
    const key = 'sculptors.agent-profile.org_01MINE';

    storage.setItem(key, '{not json');
    expect(store.load()).toBeNull();

    storage.setItem(key, JSON.stringify({ version: 2, profile: DEFAULT_AGENT_PROFILE }));
    expect(store.load()).toBeNull();

    storage.setItem(key, JSON.stringify({ version: 1, profile: { ...DEFAULT_AGENT_PROFILE, model: 'gpt-2' } }));
    expect(store.load()).toBeNull();
  });

  it('keeps the profile for the page when storage refuses it', () => {
    const store = createBrowserAgentProfileStore('org_01MINE', memoryStorage({ blocked: true }));
    const profile = { ...DEFAULT_AGENT_PROFILE, name: 'Juniper' };

    store.save(profile);

    expect(store.load()).toEqual(profile);
  });
});
