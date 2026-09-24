import { AppLoader } from '@/components/ui/app-loader';

/**
 * What an auth page shows while it loads. It is the login page's own opening
 * loader, so a cold visit to /auth/login paints one loader from the first
 * byte to the form instead of two: before this, the prerendered shell was a
 * leftover v1 screen (diagonal stripes, blurred blobs, "Yükleniyor...") that
 * flashed before the real loader (owner's direction, 23 Sep 2026).
 */
export default function AuthLoading() {
  return <AppLoader tone="light" />;
}
