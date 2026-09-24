"use client";

import { usePathname } from "next/navigation";
import { memo, type ReactNode, useState } from "react";
import { OrganizationSetupScreen } from "@/components/organizations/organization-setup-screen";
import { AppLoader } from "@/components/ui/app-loader";
import { useAuth } from "@/contexts/auth-context";
import { useOrganizations } from "@/contexts/organization-context";
import { useDashboardTheme } from "@/hooks/use-dashboard-theme";
import { cn } from "@/lib/utils";
import { getCurrentTitle, MobileNavigationButton, Sidebar } from "./sidebar";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

export const AppLayout = memo(function AppLayout({ children, className }: AppLayoutProps) {
  const { loading: sessionLoading } = useAuth();
  const { activeOrganization } = useOrganizations();
  const pathname = usePathname();
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  // Dark or light (Settings > Appearance). The shell's root carries it as
  // data-dashboard-theme, and globals.css turns that into the rail, page,
  // divider and text tokens everything inside reads.
  const theme = useDashboardTheme();

  // The app opens on the loader until the session check answers -- once per
  // page load, never on navigation, because the provider only loads once.
  if (sessionLoading) {
    return <AppLoader tone="light" />;
  }

  // An organization nobody has set up opens on the setup screen instead of
  // the dashboard. It is drawn on its own, like the login page it matches,
  // not inside the shell below: the shell's styles belong to the dashboard,
  // and a screen on the dark auth ground must not inherit them.
  if (activeOrganization && !activeOrganization.onboardingCompletedAt) {
    return <OrganizationSetupScreen key={activeOrganization.id} organization={activeOrganization} />;
  }

  return (
    <div
      data-dashboard-theme={theme}
      className={cn(
        "relative flex h-screen w-full overflow-hidden transition-colors duration-200",
        "dashboard-light bg-[var(--dashboard-panel)] text-[var(--dashboard-text)]"
      )}
    >
      <Sidebar
        mobileOpen={isMobileNavigationOpen}
        onMobileOpenChange={setIsMobileNavigationOpen}
      />

      <main
        className={cn(
          "relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          // The sidebar stays open. It used to be a 64px rail that widened
          // over the content on hover, with the page reserving only the
          // narrow width so it never reflowed; now the page reserves the
          // open width and nothing moves at all.
          // The rail floats 12px in from the window's edges; the page fills
          // the rest on the theme's own ground, so nothing frames it. The
          // phone keeps its header bar above.
          "p-2 lg:p-0 lg:pl-[268px]"
        )}
      >
        <MobileNavigationButton
          title={getCurrentTitle(pathname)}
          onClick={() => setIsMobileNavigationOpen(true)}
        />
        <div
          className={cn(
            // The page: the theme's own ground (#141414 dark, #F7F7F7 light)
            // with the floating rail beside it. It was a white, then a
            // near-black, rounded panel inside a frame; the frame is gone
            // and the cards on it follow the theme.
            //
            // It always takes the full width beside the rail. A second white
            // panel used to sit between them on /products, /orders and
            // /settings, listing that section's pages; every page it listed
            // is a rail entry, and the owner removed it (23 Sep 2026).
            "min-h-0 flex-1 overflow-y-auto rounded-[14px] bg-[var(--dashboard-panel)] text-[var(--dashboard-text)] lg:rounded-none",
            className
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
});
