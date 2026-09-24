import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_PROFILE, type AgentProfile } from '../domain/agent-profile';
import type { AgentProfileStore } from './ports';
import { saveAgentProfile } from './save-agent-profile';

function memoryStore(): AgentProfileStore & { kept: AgentProfile | null } {
  const store = {
    kept: null as AgentProfile | null,
    load: () => store.kept,
    save: (profile: AgentProfile) => {
      store.kept = profile;
    },
    subscribe: () => () => {},
  };

  return store;
}

describe('saveAgentProfile', () => {
  it('keeps the draft as it will be read back: trimmed, empty rules dropped', () => {
    const store = memoryStore();
    const result = saveAgentProfile(store, {
      ...DEFAULT_AGENT_PROFILE,
      name: ' Juniper ',
      rules: [...DEFAULT_AGENT_PROFILE.rules, { id: 'blank', text: '  ' }],
    });

    expect(result.ok).toBe(true);
    expect(store.kept?.name).toBe('Juniper');
    expect(store.kept?.rules).toEqual(DEFAULT_AGENT_PROFILE.rules);
  });

  it('keeps nothing when the draft has problems, and says which', () => {
    const store = memoryStore();

    expect(saveAgentProfile(store, { ...DEFAULT_AGENT_PROFILE, name: '   ' })).toEqual({
      ok: false,
      problems: { name: 'Give your agent a name.' },
    });
    expect(store.kept).toBeNull();
  });
});
