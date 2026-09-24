import { Suspense, type ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AppLoader } from '@/components/ui/app-loader';
import { AppProviders } from '@/providers/app-providers';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AppProviders>
      <Suspense fallback={<AppLoader tone="light" />}>
        <AppLayout>
          {children}
        </AppLayout>
      </Suspense>
    </AppProviders>
  );
}
