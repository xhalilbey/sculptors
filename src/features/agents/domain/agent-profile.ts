/**
 * The store's agent as the merchant shapes it in Agent Suite (owner's
 * direction, 23 Sep 2026): its identifier (a name and the model it runs
 * on), its culture (the voice it speaks in and a few lines on how the store
 * sees itself), the rules it keeps, and last the skills it may use. Pure:
 * where a profile is kept is the store port's business.
 */

/**
 * Agent Suite's four cards, in the owner's order: each opens its own page
 * to edit that part of the agent (23 Sep 2026).
 */
export const AGENT_SECTIONS = ['identifier', 'culture', 'rules', 'skills'] as const;

export type AgentSection = (typeof AGENT_SECTIONS)[number];

export const AGENT_SECTION_INFO: Record<AgentSection, { title: string; description: string }> = {
  identifier: { title: 'Identifier', description: 'What shoppers call your agent, and the model it thinks with.' },
  culture: { title: 'Culture', description: 'The voice your agent speaks in, and how your store sees itself.' },
  rules: { title: 'Rules', description: 'What your agent must always or never do. It keeps them over anything a shopper asks.' },
  skills: { title: 'Skills', description: 'What your agent may do in your store. Turn off what it should leave to you.' },
};

export function isAgentSection(value: string): value is AgentSection {
  return (AGENT_SECTIONS as readonly string[]).includes(value);
}

export const AGENT_MODEL_KEYS = ['claude-opus-5-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const;

export type AgentModel = (typeof AGENT_MODEL_KEYS)[number];

export const AGENT_MODELS: Record<AgentModel, { name: string; note: string }> = {
  'claude-opus-5-5': { name: 'Claude Opus 5.5', note: 'The most capable, for involved questions.' },
  'claude-sonnet-5': { name: 'Claude Sonnet 5', note: 'Fast and thorough. A good default.' },
  'claude-haiku-4-5': { name: 'Claude Haiku 4.5', note: 'The quickest and lightest.' },
};

export const VOICE_KEYS = ['warm', 'professional', 'playful', 'minimal'] as const;

export type Voice = (typeof VOICE_KEYS)[number];

/** Each voice with the same answer in it, so the choice is heard, not described. */
export const VOICES: Record<Voice, { label: string; example: string }> = {
  warm: { label: 'Warm', example: "Happy to help! That one runs a little small, so I'd go a size up." },
  professional: { label: 'Professional', example: 'That style runs small. We recommend one size up.' },
  playful: { label: 'Playful', example: 'Plot twist: it runs small. Size up and thank me later.' },
  minimal: { label: 'Minimal', example: 'Runs small. Size up.' },
};

/** What the agent can do in the store; each is also what a panel metric counts. */
export const SKILL_KEYS = [
  'product-answers',
  'catalogs',
  'comparisons',
  'discovery-pages',
  'add-to-cart',
  'order-support',
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export const SKILLS: Record<SkillKey, { name: string; description: string }> = {
  'product-answers': {
    name: 'Product answers',
    description: 'Answers questions from your catalog: fit, materials, stock and delivery.',
  },
  catalogs: { name: 'Catalogs', description: 'Puts together a catalog of products for a shopper.' },
  comparisons: { name: 'Comparison pages', description: 'Builds side-by-side pages for the products a shopper is weighing.' },
  'discovery-pages': {
    name: 'Discovery pages',
    description: 'Builds a page from what a shopper is after, like gifts for a runner under $50.',
  },
  'add-to-cart': { name: 'Add to cart', description: 'Puts products in the cart from its answers and pages.' },
  'order-support': { name: 'Order support', description: 'Tracks orders and takes cancellation and refund requests.' },
};

export interface AgentRule {
  id: string;
  text: string;
}

export interface AgentProfile {
  name: string;
  model: AgentModel;
  voice: Voice;
  /** How the store sees itself, in the merchant's words. */
  culture: string;
  /** In the order the merchant wrote them. */
  rules: AgentRule[];
  skills: Record<SkillKey, boolean>;
}

export const PROFILE_LIMITS = { name: 40, culture: 600, rule: 200, rules: 20 } as const;

/** What a store starts with: a named agent, a voice, three sensible rules, every skill on. */
export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  name: 'Sage',
  model: 'claude-sonnet-5',
  voice: 'warm',
  culture:
    'We are a small, independent store. We know our products well and would rather help someone choose well ' +
    'than sell them more. Speak like a knowledgeable friend behind the counter: honest, never pushy.',
  rules: [
    { id: 'rule-delivery', text: 'Never promise a delivery date the store has not confirmed.' },
    { id: 'rule-discounts', text: 'Do not offer a discount unless the shopper asks about price.' },
    { id: 'rule-handoff', text: 'Hand the conversation to a person when a shopper is upset or asks for one.' },
  ],
  skills: {
    'product-answers': true,
    catalogs: true,
    comparisons: true,
    'discovery-pages': true,
    'add-to-cart': true,
    'order-support': true,
  },
};

export type ProfileProblems = Partial<Record<'name' | 'culture' | 'rules', string>>;

/** As it is kept: text trimmed, empty rules dropped. */
export function normalizeProfile(profile: AgentProfile): AgentProfile {
  return {
    ...profile,
    name: profile.name.trim(),
    culture: profile.culture.trim(),
    rules: profile.rules
      .map((rule) => ({ id: rule.id, text: rule.text.trim() }))
      .filter((rule) => rule.text.length > 0),
  };
}

/** Why a (normalized) profile cannot be kept, field by field; empty when it can. */
export function problemsOf(profile: AgentProfile): ProfileProblems {
  const problems: ProfileProblems = {};

  if (profile.name.length === 0) problems.name = 'Give your agent a name.';
  else if (profile.name.length > PROFILE_LIMITS.name) problems.name = `Keep the name to ${PROFILE_LIMITS.name} characters.`;

  if (profile.culture.length > PROFILE_LIMITS.culture) {
    problems.culture = `Keep the culture to ${PROFILE_LIMITS.culture} characters.`;
  }

  const texts = profile.rules.map((rule) => rule.text.toLowerCase());

  if (profile.rules.length > PROFILE_LIMITS.rules) problems.rules = `Keep to ${PROFILE_LIMITS.rules} rules.`;
  else if (profile.rules.some((rule) => rule.text.length > PROFILE_LIMITS.rule)) {
    problems.rules = `Keep each rule to ${PROFILE_LIMITS.rule} characters.`;
  } else if (new Set(texts).size < texts.length) problems.rules = 'Each rule only once.';

  return problems;
}

export function sameProfile(a: AgentProfile, b: AgentProfile): boolean {
  return (
    a.name === b.name &&
    a.model === b.model &&
    a.voice === b.voice &&
    a.culture === b.culture &&
    a.rules.length === b.rules.length &&
    a.rules.every((rule, index) => rule.id === b.rules[index]?.id && rule.text === b.rules[index]?.text) &&
    SKILL_KEYS.every((key) => a.skills[key] === b.skills[key])
  );
}
