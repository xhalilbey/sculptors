import { z } from 'zod';
import type { PipelineStore } from '../application/ports';
import { PIPELINE_KINDS, PIPELINE_LIMITS, SYNC_DATA, TRIGGERS, type Pipeline } from '../domain/pipeline';

/**
 * The demo's pipeline store: the browser's localStorage, one list per
 * organization, versioned and read through a schema so an entry it cannot
 * trust reads as an empty list instead of breaking the page. When storage
 * is blocked the list lasts for the page.
 */

const KEY_PREFIX = 'sculptors.pipelines.';
const CHANGE_EVENT = 'sculptors:pipelines';
const EMPTY: readonly Pipeline[] = [];

const storedSchema = z.object({
  version: z.literal(1),
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        kind: z.enum(PIPELINE_KINDS),
        name: z.string().min(1).max(PIPELINE_LIMITS.name),
        data: z.array(z.enum(SYNC_DATA)).max(SYNC_DATA.length),
        trigger: z.enum(TRIGGERS),
        tags: z.array(z.string().min(1).max(PIPELINE_LIMITS.tag)).max(PIPELINE_LIMITS.tags),
        ownerId: z.string().min(1).max(128),
        runAs: z.string().min(1).max(200),
        favorite: z.boolean(),
        createdAt: z.iso.datetime(),
      })
    )
    .max(PIPELINE_LIMITS.items),
});

function parse(raw: string | null): readonly Pipeline[] {
  if (raw === null) return EMPTY;

  try {
    const stored = storedSchema.safeParse(JSON.parse(raw));

    return stored.success ? stored.data.items : EMPTY;
  } catch {
    return EMPTY;
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createBrowserPipelineStore(organizationId: string, storage: Storage | null = browserStorage()): PipelineStore {
  const key = `${KEY_PREFIX}${organizationId}`;
  // This page's copy, for when storage refuses to keep one.
  let memory: string | null = null;
  let cache: { raw: string | null; items: readonly Pipeline[] } | null = null;

  const read = (): string | null => {
    try {
      return storage?.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  };

  return {
    load() {
      const raw = read();

      // The same array for the same entry: React compares snapshots by identity.
      if (cache?.raw !== raw) cache = { raw, items: parse(raw) };

      return cache.items;
    },

    save(items) {
      const raw = JSON.stringify({ version: 1, items });

      memory = raw;

      try {
        storage?.setItem(key, raw);
      } catch {
        // Blocked or full: the page's copy above still holds it.
      }

      if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
    },

    subscribe(onChange) {
      if (typeof window === 'undefined') return () => {};

      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) onChange();
      };

      window.addEventListener(CHANGE_EVENT, onChange);
      window.addEventListener('storage', onStorage);

      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}
