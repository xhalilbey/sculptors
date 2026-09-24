import type { Metadata } from 'next';
import { HealthScreen } from '@/features/health';

export const metadata: Metadata = {
  title: 'System Health | Sculptors',
};

export default function SettingsHealthPage() {
  return <HealthScreen />;
}
