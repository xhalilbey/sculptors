import { z } from 'zod';
import type { AgentProfileStore } from '../application/ports';
import { AGENT_MODEL_KEYS, PROFILE_LIMITS, SKILL_KEYS, VOICE_KEYS, type AgentProfile } from '../domain/agent-profile';

/**
 * The demo's agent profile store: the browser's localStorage, one entry per
 * organization. Kept versioned and read through a schema, so an entry an
 * older build wrote, or someone edited by hand, reads as no profile (the
 * page then opens on the defaults) instead of breaking the page. When
 * storage is blocked (private windows) the profile lasts for the page.
 */

const KEY_PREFIX = 'sculptors.agent-profile.';
const CHANGE_EVENT = 'sculptors:agent-profile';

const storedSchema = z.object({
  version: z.literal(1),
  profile: z.object({
    name: z.string().min(1).max(PROFILE_LIMITS.name),
    model: z.enum(AGENT_MODEL_KEYS),
    voice: z.enum(VOICE_KEYS),
    culture: z.string().max(PROFILE_LIMITS.culture),
    rules: z
      .array(z.object({ id: z.string().min(1).max(64), text: z.string().min(1).max(PROFILE_LIMITS.rule) }))
      .max(PROFILE_LIMITS.rules),
    skills: z.record(z.enum(SKILL_KEYS), z.boolean()),
  }),
});

function parse(raw: string | null): AgentProfile | null {
  if (raw === null) return null;

  try {
    const stored = storedSchema.safeParse(JSON.parse(raw));

    return stored.success ? stored.data.profile : null;
  } catch {
    return null;
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createBrowserAgentProfileStore(
  organizationId: string,
  storage: Storage | null = browserStorage()
): AgentProfileStore {
  const key = `${KEY_PREFIX}${organizationId}`;
  // This page's copy, for when storage refuses to keep one.
  let memory: string | null = null;
  let cache: { raw: string | null; profile: AgentProfile | null } | null = null;

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

      // The same object for the same entry: React compares snapshots by identity.
      if (cache?.raw !== raw) cache = { raw, profile: parse(raw) };

      return cache.profile;
    },

    save(profile) {
      const raw = JSON.stringify({ version: 1, profile });

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
