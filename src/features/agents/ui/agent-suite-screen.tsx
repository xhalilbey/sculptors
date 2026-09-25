'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { BAND_CAPTION, BLUE_BAND, darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme, type DashboardTheme } from '@/hooks/use-dashboard-theme';
import { cn } from '@/lib/utils';
import {
  AGENT_MODELS,
  AGENT_SECTION_INFO,
  AGENT_SECTIONS,
  SKILL_KEYS,
  SKILLS,
  VOICES,
  type AgentProfile,
  type AgentSection,
} from '../domain/agent-profile';
import { AgentMark, SectionIcon, SKILL_ICONS } from './parts';
import { useAgentProfile } from './use-agent-profile';

/**
 * Agent Suite: the store's agent as four cards, like the Store Events
 * Panel's tiles -- a clean icon and a title at the top, a glimpse of what
 * is set in the middle, and the one thing to know in the blue band at the
 * foot. Each card opens its own page, where that part of the agent is
 * edited (owner's direction, 23 Sep 2026; it replaced one long form of
 * four numbered steps). Like the tiles, the cards do not move under the
 * pointer.
 */

const RULES_SHOWN = 3;

function Glimpse({ section, profile }: { section: AgentSection; profile: AgentProfile }) {
  switch (section) {
    case 'identifier':
      return (
        <div className="flex items-center gap-3.5">
          <AgentMark name={profile.name} size="large" />
          <p className="text-[13px] leading-5 text-[var(--card-text-muted)]">{AGENT_MODELS[profile.model].note}</p>
        </div>
      );
    case 'culture':
      return profile.culture ? (
        <p className="line-clamp-3 text-[13px] leading-5 text-[var(--card-text-muted)]">{profile.culture}</p>
      ) : (
        <p className="text-[13px] text-[var(--card-text-faint)]">No culture written yet.</p>
      );
    case 'rules':
      return profile.rules.length > 0 ? (
        <ol className="space-y-1.5">
          {profile.rules.slice(0, RULES_SHOWN).map((rule, index) => (
            <li key={rule.id} className="flex gap-2.5 text-[13px] leading-5 text-[var(--card-text-muted)]">
              <span className="w-3 shrink-0 tabular-nums text-[var(--card-text-faint)]">{index + 1}</span>
              <span className="truncate">{rule.text}</span>
            </li>
          ))}
          {profile.rules.length > RULES_SHOWN ? (
            <li className="pl-[22px] text-[12px] text-[var(--card-text-faint)]">and {profile.rules.length - RULES_SHOWN} more</li>
          ) : null}
        </ol>
      ) : (
        <p className="text-[13px] text-[var(--card-text-faint)]">No rules yet.</p>
      );
    case 'skills':
      return (
        <div className="flex flex-wrap gap-1.5">
          {SKILL_KEYS.map((key) => {
            const Icon = SKILL_ICONS[key];
            const on = profile.skills[key];

            return (
              <span
                key={key}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px]',
                  on
                    ? 'border-[var(--dashboard-line)] text-[var(--card-text-soft)]'
                    : 'border-dashed border-[var(--dashboard-line)] text-[var(--card-text-faint)]'
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {SKILLS[key].name}
                <span className="sr-only">{on ? '(on)' : '(off)'}</span>
              </span>
            );
          })}
        </div>
      );
  }
}

/** The band's number and caption for a section. */
function headline(section: AgentSection, profile: AgentProfile): { value: string; caption: string } {
  switch (section) {
    case 'identifier':
      return { value: profile.name.trim() || 'Unnamed agent', caption: AGENT_MODELS[profile.model].name };
    case 'culture':
      return { value: VOICES[profile.voice].label, caption: 'Voice' };
    case 'rules':
      return { value: String(profile.rules.length), caption: profile.rules.length === 1 ? 'Rule it keeps' : 'Rules it keeps' };
    case 'skills': {
      const on = SKILL_KEYS.filter((key) => profile.skills[key]).length;

      return { value: `${on} of ${SKILL_KEYS.length}`, caption: 'Skills on' };
    }
  }
}

function AgentCard({ section, profile, tone }: { section: AgentSection; profile: AgentProfile; tone: DashboardTheme }) {
  const info = AGENT_SECTION_INFO[section];
  const { value, caption } = headline(section, profile);

  return (
    <Link
      href={`/agent-center/${section}`}
      className={cn(
        tone === 'dark' ? darkCard : lightCard,
        'group flex min-h-[264px] flex-col',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]'
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <SectionIcon section={section} />
          <h2 className="text-[15px] font-semibold text-[var(--card-text)]">{info.title}</h2>
        </div>
        <ArrowUpRight
          className="h-4 w-4 text-[var(--card-text-faint)] transition-colors group-hover:text-[var(--card-text)]"
          aria-hidden="true"
        />
      </div>

      <div className="mt-5 min-h-0 flex-1 px-5">
        <Glimpse section={section} profile={profile} />
      </div>

      <div className={cn(BLUE_BAND[tone], 'm-2 mt-5 px-4 pb-4 pt-3.5')}>
        <p className="truncate text-[30px] font-semibold leading-9 tracking-[-0.02em] text-white">{value}</p>
        <p className={cn('mt-0.5 text-[13px]', BAND_CAPTION[tone])}>{caption}</p>
      </div>
    </Link>
  );
}

export function AgentSuiteScreen() {
  const theme = useDashboardTheme();
  const { profile } = useAgentProfile();

  return (
    <section className="min-h-full px-6 pb-14 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em]">Agent Suite</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {AGENT_SECTIONS.map((section) => (
          <AgentCard key={section} section={section} profile={profile} tone={theme} />
        ))}
      </div>
    </section>
  );
}
