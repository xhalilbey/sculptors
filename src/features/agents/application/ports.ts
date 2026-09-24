import type { AgentProfile } from '../domain/agent-profile';

/**
 * Where an organization's agent profile is kept. The browser keeps it for
 * the demo; the agent API replaces the adapter when it exists, and nothing
 * above the port changes.
 */
export interface AgentProfileStore {
  /** The kept profile, or null when there is none (or it cannot be read). The same object until it changes. */
  load(): AgentProfile | null;
  save(profile: AgentProfile): void;
  /** Calls back when the kept profile changes, here or in another tab. Returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}
