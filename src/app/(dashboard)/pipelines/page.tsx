import type { Metadata } from 'next';
import { PipelinesScreen } from '@/features/pipelines';

export const metadata: Metadata = {
  title: 'Pipelines | Sculptors',
};

export default function PipelinesRoute() {
  return <PipelinesScreen />;
}
