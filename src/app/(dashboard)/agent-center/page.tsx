import type { Metadata } from 'next';
import { AgentSuiteScreen } from '@/features/agents';

export const metadata: Metadata = {
  title: 'Agent Suite | Sculptors',
};

export default function AgentCenterPage() {
  return <AgentSuiteScreen />;
}
