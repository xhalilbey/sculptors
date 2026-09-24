import { AppLoader } from '@/components/ui/app-loader';

/**
 * Dashboard-level loading state: the fallback for a page loading inside the
 * shell. It is the app's loader at the size of the content panel, so a page
 * that takes a moment shows the same tile the app opened on, in the middle
 * of the panel, rather than a separate little spinner (owner's direction,
 * 23 Sep 2026), in its dark tone on the dark panel. The layout's own
 * fallback is the same loader, full screen.
 */
export default function DashboardLoading() {
  return <AppLoader tone="dark" fullscreen={false} />;
}
