import { normalizeProfile, problemsOf, type AgentProfile, type ProfileProblems } from '../domain/agent-profile';
import type { AgentProfileStore } from './ports';

export type SaveResult = { ok: true; profile: AgentProfile } | { ok: false; problems: ProfileProblems };

/** Keeps the draft as it will be read back -- trimmed, empty rules dropped -- or says why it cannot. */
export function saveAgentProfile(store: AgentProfileStore, draft: AgentProfile): SaveResult {
  const profile = normalizeProfile(draft);
  const problems = problemsOf(profile);

  if (Object.keys(problems).length > 0) return { ok: false, problems };

  store.save(profile);

  return { ok: true, profile };
}
