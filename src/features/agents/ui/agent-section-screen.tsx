'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { cn } from '@/lib/utils';
import { AGENT_SECTION_INFO, type AgentSection } from '../domain/agent-profile';
import { SaveBar, SectionEditor } from './editors';
import { SectionIcon } from './parts';
import { useAgentProfile } from './use-agent-profile';

/**
 * One Agent Suite card, opened: its editor on a card, with the bar that
 * saves or discards the draft. Leaving by the back link with unsaved
 * changes asks first.
 */
export function AgentSectionScreen({ section }: { section: AgentSection }) {
  const theme = useDashboardTheme();
  const editor = useAgentProfile();
  const info = AGENT_SECTION_INFO[section];

  return (
    <section className="min-h-full px-6 pb-4 pt-6 text-[var(--dashboard-text)] lg:px-10">
      <div className="max-w-[880px]">
        <Link
          href="/agent-center"
          onClick={(event) => {
            if (editor.dirty && !window.confirm('You have unsaved changes. Leave without saving them?')) event.preventDefault();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-3 text-[13px] font-medium text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-fill)] hover:text-[var(--dashboard-text)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Agent Suite
        </Link>

        <header className="mt-3 flex items-center gap-3.5">
          <SectionIcon section={section} size="large" />
          <div>
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">{info.title}</h1>
            <p className="mt-0.5 text-[14px] text-[var(--dashboard-text-muted)]">{info.description}</p>
          </div>
        </header>

        <div className={cn(theme === 'dark' ? darkCard : lightCard, 'mt-6 p-6')}>
          <SectionEditor section={section} editor={editor} />
        </div>

        <SaveBar editor={editor} tone={theme} />
      </div>
    </section>
  );
}
