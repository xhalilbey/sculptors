import { describe, expect, it } from 'vitest';
import {
  AGENT_SECTIONS,
  DEFAULT_AGENT_PROFILE,
  isAgentSection,
  normalizeProfile,
  PROFILE_LIMITS,
  problemsOf,
  sameProfile,
  type AgentProfile,
} from './agent-profile';

function profile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return { ...DEFAULT_AGENT_PROFILE, ...overrides };
}

describe('the default profile', () => {
  it('can be kept as it is', () => {
    expect(problemsOf(normalizeProfile(DEFAULT_AGENT_PROFILE))).toEqual({});
  });
});

describe('normalizeProfile', () => {
  it('trims the text and drops rules left empty', () => {
    const normalized = normalizeProfile(
      profile({
        name: '  Sage  ',
        culture: ' Honest. \n',
        rules: [
          { id: 'a', text: '  Be kind.  ' },
          { id: 'b', text: '   ' },
        ],
      })
    );

    expect(normalized.name).toBe('Sage');
    expect(normalized.culture).toBe('Honest.');
    expect(normalized.rules).toEqual([{ id: 'a', text: 'Be kind.' }]);
  });
});

describe('problemsOf', () => {
  it('asks for a name, and keeps it short', () => {
    expect(problemsOf(profile({ name: '' })).name).toBe('Give your agent a name.');
    expect(problemsOf(profile({ name: 'x'.repeat(PROFILE_LIMITS.name + 1) })).name).toMatch(/40 characters/);
  });

  it('keeps the culture and every rule within their lengths', () => {
    expect(problemsOf(profile({ culture: 'x'.repeat(PROFILE_LIMITS.culture + 1) })).culture).toMatch(/600 characters/);
    expect(problemsOf(profile({ rules: [{ id: 'a', text: 'x'.repeat(PROFILE_LIMITS.rule + 1) }] })).rules).toMatch(
      /200 characters/
    );
  });

  it('keeps to twenty rules, each only once whatever its case', () => {
    const many = Array.from({ length: PROFILE_LIMITS.rules + 1 }, (_, index) => ({ id: String(index), text: `Rule ${index}` }));

    expect(problemsOf(profile({ rules: many })).rules).toBe('Keep to 20 rules.');
    expect(
      problemsOf(
        profile({
          rules: [
            { id: 'a', text: 'Be kind.' },
            { id: 'b', text: 'be KIND.' },
          ],
        })
      ).rules
    ).toBe('Each rule only once.');
  });
});

describe('sameProfile', () => {
  it('compares every part, rules in order and every skill', () => {
    const base = profile();

    expect(sameProfile(base, profile())).toBe(true);
    expect(sameProfile(base, profile({ model: 'claude-opus-5-5' }))).toBe(false);
    expect(sameProfile(base, profile({ rules: [...base.rules].reverse() }))).toBe(false);
    expect(sameProfile(base, profile({ skills: { ...base.skills, catalogs: false } }))).toBe(false);
  });
});

describe('the sections', () => {
  it('are the four cards in the order the owner gave, and nothing else is one', () => {
    expect(AGENT_SECTIONS).toEqual(['identifier', 'culture', 'rules', 'skills']);
    expect(isAgentSection('rules')).toBe(true);
    expect(isAgentSection('pipelines')).toBe(false);
  });
});
