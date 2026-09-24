import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AppLoader } from '@/components/ui/app-loader';
import { AGENT_SECTION_INFO, AGENT_SECTIONS, AgentSectionScreen, isAgentSection } from '@/features/agents';

type SectionPageProps = { params: Promise<{ section: string }> };

export function generateStaticParams() {
  return AGENT_SECTIONS.map((section) => ({ section }));
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;

  return { title: isAgentSection(section) ? `${AGENT_SECTION_INFO[section].title} · Agent Suite | Sculptors` : 'Sculptors' };
}

async function SectionRoute({ params }: SectionPageProps) {
  const { section } = await params;

  if (!isAgentSection(section)) notFound();

  // Keyed by section so moving between two cards' pages starts each from the kept profile.
  return <AgentSectionScreen key={section} section={section} />;
}

/** /agent-center/<section>: one Agent Suite card, opened to edit. */
export default function AgentSectionPage({ params }: SectionPageProps) {
  return (
    <Suspense fallback={<AppLoader tone="dark" fullscreen={false} />}>
      <SectionRoute params={params} />
    </Suspense>
  );
}
