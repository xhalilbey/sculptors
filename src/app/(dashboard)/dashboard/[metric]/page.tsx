import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AppLoader } from '@/components/ui/app-loader';
import { isMetricKey, METRIC_KEYS, METRICS, MetricDetailScreen } from '@/features/metrics';

type MetricPageProps = { params: Promise<{ metric: string }> };

export function generateStaticParams() {
  return METRIC_KEYS.map((metric) => ({ metric }));
}

export async function generateMetadata({ params }: MetricPageProps): Promise<Metadata> {
  const { metric } = await params;

  return { title: isMetricKey(metric) ? `${METRICS[metric].label} | Sculptors` : 'Sculptors' };
}

async function MetricRoute({ params }: MetricPageProps) {
  const { metric } = await params;

  if (!isMetricKey(metric)) notFound();

  // Keyed by metric so moving between two metrics' pages never shows one
  // metric's numbers under the other's name while the new ones load.
  return <MetricDetailScreen key={metric} metric={metric} />;
}

/** /dashboard/<metric>: one Overview tile at full size. */
export default function MetricPage({ params }: MetricPageProps) {
  return (
    <Suspense fallback={<AppLoader tone="dark" fullscreen={false} />}>
      <MetricRoute params={params} />
    </Suspense>
  );
}
