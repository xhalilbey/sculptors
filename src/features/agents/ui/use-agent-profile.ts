'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useOrganizations } from '@/contexts/organization-context';
import { saveAgentProfile } from '../application/save-agent-profile';
import {
  DEFAULT_AGENT_PROFILE,
  normalizeProfile,
  problemsOf,
  sameProfile,
  type AgentProfile,
  type ProfileProblems,
} from '../domain/agent-profile';
import { createBrowserAgentProfileStore } from '../infrastructure/browser-agent-profile-store';

export interface AgentProfileEditor {
  /** What the page shows: the draft while there is one, else the kept profile. */
  profile: AgentProfile;
  /** The draft differs from what is kept. */
  dirty: boolean;
  problems: ProfileProblems;
  update: (change: (current: AgentProfile) => AgentProfile) => void;
  /** Keeps the draft; false when it has problems. */
  save: () => boolean;
  discard: () => void;
}

/**
 * The organization's agent profile and a draft of it. Edits change only the
 * draft; Save keeps it (trimmed), Discard drops it. The server renders the
 * defaults, and the kept profile arrives right after hydration.
 */
export function useAgentProfile(): AgentProfileEditor {
  const { activeOrganization } = useOrganizations();
  const organizationId = activeOrganization?.id ?? 'none';
  const store = useMemo(() => createBrowserAgentProfileStore(organizationId), [organizationId]);
  const kept = useSyncExternalStore(
    store.subscribe,
    () => store.load() ?? DEFAULT_AGENT_PROFILE,
    () => DEFAULT_AGENT_PROFILE
  );
  const [draft, setDraft] = useState<AgentProfile | null>(null);
  const profile = draft ?? kept;
  const normalized = useMemo(() => normalizeProfile(profile), [profile]);

  const update = useCallback(
    (change: (current: AgentProfile) => AgentProfile) => setDraft((current) => change(current ?? kept)),
    [kept]
  );

  const save = useCallback(() => {
    if (draft === null) return true;

    const result = saveAgentProfile(store, draft);

    if (result.ok) setDraft(null);

    return result.ok;
  }, [draft, store]);

  const discard = useCallback(() => setDraft(null), []);

  return {
    profile,
    dirty: draft !== null && !sameProfile(normalized, kept),
    problems: problemsOf(normalized),
    update,
    save,
    discard,
  };
}
