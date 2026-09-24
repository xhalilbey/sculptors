import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppLoader } from '@/components/ui/app-loader';
import { OverviewScreen } from '@/features/metrics';

export const metadata: Metadata = {
  title: 'Store Events Panel | Sculptors',
};

// The panel reads its range from the URL, which needs a Suspense boundary.
export default function DashboardOverviewPage() {
  return (
    <Suspense fallback={<AppLoader tone="dark" fullscreen={false} />}>
      <OverviewScreen />
    </Suspense>
  );
}
