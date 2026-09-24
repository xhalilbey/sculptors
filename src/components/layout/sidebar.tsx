"use client";

import {
  Activity,
  BookText,
  Megaphone,
  Menu,
  Plug,
  Settings,
  Store,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useCallback, useState } from "react";
import { SculptorsMark } from "@/components/brand/sculptors-mark";
import { NAVIGATION_GROUPS } from "@/config/constants";
import { useDashboardTheme } from "@/hooks/use-dashboard-theme";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const storeItems = NAVIGATION_GROUPS.flatMap((group) => group.items);

/*
 * The platform under both sides of the rail -- how to connect to it, and
 * whether it is running -- sits at the foot with Settings. These were the
 * Developers | Guides tabs' own entries; neither Store nor Ads owns them.
 */
const PLATFORM_ITEMS: NavItem[] = [
  { title: "Integrations", href: "/integrations", icon: Plug },
  { title: "API docs", href: "/settings/api/docs", icon: BookText },
  { title: "Health", href: "/settings/health", icon: Activity },
];

// The icon column is fixed at 40px inside a 12px margin, so an icon's
// centre lands at x=32 in the 64px rail and in the 244px panel alike --
// opening the sidebar reveals labels without moving a single icon.
const globalMenuItem =
  "mx-3 grid h-9 w-[calc(100%-24px)] grid-cols-[40px_minmax(0,1fr)_auto] items-center overflow-hidden rounded-[10px] border border-transparent text-left text-[13px] font-semibold tracking-[-0.003em] transition-colors";

const menuIcon = "h-[15px] w-[15px] shrink-0 justify-self-center";

/**
 * The rail's surfaces in each theme (Settings > Appearance). Whatever is
 * active -- a row, Settings, the Store key -- is a raised key: in Dark a
 * top-lit gradient with an inner highlight and a shadow; in Grey the
 * landing's "Book a demo" button (.btn-ghost), a flat #EBEBEB face, a ring
 * dark where the light does not reach and white at the foot, and two inner
 * highlights (owner's direction, 23 Sep 2026). Overview, Agent Suite and
 * Pipelines also sat in a raised block of the same recipe; the owner kept
 * the key and dropped the block the same day.
 */
const RAIL = {
  dark: {
    activeKey:
      "text-white [background:linear-gradient(180deg,#3d3d3d,#2a2a2a)] " +
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_3.3px_13.3px_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.55),0_6px_12px_-6px_rgba(0,0,0,0.8)]",
    frame: "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_36px_rgba(0,0,0,0.45)]",
    switchBorder: "border-white/16",
    soon: "bg-white text-[#0a0a0a] shadow-[0_0_0_2px_var(--color-rail)]",
    avatar: "border-white/15 bg-white/12 text-white",
    badge: "bg-white/12 text-white/70",
    brand: "text-white",
  },
  light: {
    activeKey:
      "text-[#0b0e11] [background:linear-gradient(#ebebeb,#ebebeb)_padding-box,linear-gradient(rgba(0,0,0,0.13),rgba(255,255,255,0.68))_border-box] " +
      "shadow-[inset_0_3.3px_13.3333px_rgba(255,255,255,0.2),inset_0_0.8px_3.3px_#fff]",
    frame: "shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_12px_32px_rgba(17,24,39,0.1)]",
    switchBorder: "border-black/10",
    soon: "border border-black/10 bg-white text-ink shadow-[0_0_0_2px_var(--color-rail),0_1px_3px_rgba(0,0,0,0.15)]",
    avatar: "border-black/10 bg-white text-ink",
    badge: "bg-black/[0.06] text-ink/60",
    brand: "text-ink",
  },
} as const;

function useRail() {
  return RAIL[useDashboardTheme()];
}

/** Labels are present in both states and only fade, so nothing reflows. */
function labelClass(collapsed: boolean) {
  return cn(
    "min-w-0 truncate transition-opacity duration-150",
    collapsed ? "opacity-0" : "opacity-100 delay-100"
  );
}

/** Every entry the rail can show: the Store side, then the foot. */
const SETTINGS_ITEM: NavItem = { title: "Settings", href: "/settings", icon: Settings };
const footItems: NavItem[] = [...PLATFORM_ITEMS, SETTINGS_ITEM];
const railItems: NavItem[] = [...storeItems, ...footItems];

/** An entry owns its own path and everything under it. */
function ownsPath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The one entry a page belongs to: the longest href that owns the path, so
 * an entry nested under another one's path lights alone -- Health, not
 * Settings, on /settings/health -- and a page with no entry of its own
 * lights its parent: Overview on its metric charts (/dashboard/<metric>).
 */
function railOwner(pathname: string): NavItem | undefined {
  return railItems
    .filter((item) => ownsPath(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

function isItemActive(item: NavItem, pathname: string): boolean {
  return railOwner(pathname)?.href === item.href;
}

/** The page's name in the mobile header bar: the title of its rail entry. */
export function getCurrentTitle(pathname: string): string {
  return railOwner(pathname)?.title ?? "Sculptors";
}

type AvatarProps = {
  avatarUrl?: string | null;
  displayName: string;
  avatarInitial: string;
  className?: string;
};

/**
 * The avatar as drawn: the picture, or the initial when there is none or it
 * failed to load. Separate from AvatarMark so it renders without state.
 * Only Settings > Account shows it now; the rail's Profile row that used to
 * is gone (owner's direction, 23 Sep 2026).
 *
 * The picture is a user-controlled URL on the provider's host (Google,
 * GitHub, WorkOS). It is loaded directly -- `unoptimized`, so the public
 * image optimizer never fetches or transcodes user-supplied bytes, and no
 * images.remotePatterns entry opens it to do so -- with no Referer, so the
 * host does not learn which app page showed it. A 36px avatar gains nothing
 * from optimization. The hosts are allowed by CSP img-src instead.
 */
export function AvatarFace({
  avatarUrl,
  displayName,
  avatarInitial,
  className,
  failed = false,
  onFailed,
}: AvatarProps & { failed?: boolean; onFailed?: () => void }) {
  const styles = useRail();

  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold",
        styles.avatar,
        className
      )}
    >
      {avatarUrl && !failed ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          width={36}
          height={36}
          unoptimized
          referrerPolicy="no-referrer"
          onError={onFailed}
          className="h-full w-full object-cover"
        />
      ) : (
        avatarInitial
      )}
    </span>
  );
}

/** AvatarFace that falls back to the initial when the picture fails to load. */
export function AvatarMark(props: AvatarProps) {
  const [failed, setFailed] = useState(false);

  return <AvatarFace {...props} failed={failed} onFailed={() => setFailed(true)} />;
}

/**
 * Store | Ads: the rail's two sides (owner's direction, 23 Sep 2026). Only
 * Store is open. Ads shows where it will be -- not clickable, its icon and
 * label in the rail's plain text, with a small white "Soon" tag on its top
 * corner -- and becomes a tab like Store when its pages exist. It shimmered
 * (a rainbow, then Bending Spoons' green) until the owner dropped the colour
 * the same day: the tag says enough. Before this the switch was Developers | Guides, and
 * before that Browse | Chat.
 */
function SidebarSideSwitch() {
  const styles = useRail();
  const segment =
    "flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-[7px] text-[12px] font-semibold";

  return (
    <div className={cn("grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1 rounded-[10px] border p-1", styles.switchBorder)}>
      <span className={cn(segment, "border border-transparent", styles.activeKey)} aria-current="true">
        <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Store
      </span>
      <button type="button" disabled className={cn(segment, "relative cursor-default")} aria-label="Ads, coming soon">
        <Megaphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Ads
        <span className={cn("absolute -right-1 -top-2.5 rounded-full px-1.5 text-[9px] font-semibold leading-[15px]", styles.soon)}>
          Soon
        </span>
      </button>
    </div>
  );
}

/** One rail entry. */
function RailNavLink({
  item,
  pathname,
  rail,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  rail: boolean;
  onNavigate?: () => void;
}) {
  const styles = useRail();
  const Icon = item.icon;
  const isActive = isItemActive(item, pathname);

  return (
    <Link
      href={item.disabled ? "#" : item.href}
      onClick={onNavigate}
      title={rail ? item.title : undefined}
      className={cn(
        globalMenuItem,
        isActive
          ? styles.activeKey
          : "text-[var(--dashboard-sidebar-text)] hover:bg-[var(--dashboard-sidebar-hover)] hover:text-[var(--dashboard-sidebar-text-strong)]",
        item.disabled && "pointer-events-none opacity-45"
      )}
    >
      <Icon className={menuIcon} strokeWidth={2.5} aria-hidden="true" />
      <span className={labelClass(rail)}>{item.title}</span>
      {item.badge ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-semibold",
            styles.badge,
            rail && "opacity-0"
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function GlobalSidebarMenu({
  pathname,
  onClose,
  mobile = false,
  collapsed = false,
}: {
  pathname: string;
  onClose: () => void;
  mobile?: boolean;
  collapsed?: boolean;
}) {
  // Narrow, always-visible rail: icons only, labels faded out.
  const rail = collapsed && !mobile;
  const styles = useRail();
  const leadItems = storeItems.filter((item) => item.lead);
  const restItems = storeItems.filter((item) => !item.lead);
  const onNavigate = mobile ? onClose : undefined;

  return (
    <aside
      className={cn(
        "fixed bottom-2 left-2 top-2 z-50 flex flex-col overflow-hidden rounded-[18px] bg-[var(--color-rail)] transition-[width] duration-200 ease-out lg:bottom-3 lg:left-3 lg:top-3",
        // It floats: inset from the window's edges, rounded, lifted by a ring
        // and a shadow. Pinning it to the edge was tried and the owner
        // wants it floating (23 Sep 2026, "very important"). The ground
        // around it is the page's own colour, so the inset shows no frame.
        styles.frame,
        !mobile && "hidden lg:flex",
        // Open at all times. It used to sit as a 64px rail and widen over
        // the content on hover, which is why the expanded state carried a
        // heavy shadow -- it was floating above what it covered. Now the
        // layout reserves its width, so it is a wall, not a panel, and the
        // shadow would only draw a seam down the page.
        !mobile && (collapsed ? "w-[64px]" : "w-[244px]"),
        mobile && "w-[min(86vw,284px)] shadow-[0_16px_36px_rgba(17,24,39,0.14)]"
      )}
    >
      {/* The wordmark, as the landing page sets it: the mark and "Sculptors"
          in Super Sans at weight 600 with tight tracking. The organization
          switcher that sat here moved to the rail's foot (owner's direction,
          23 Sep 2026). */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 px-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn("flex min-w-0 flex-1 items-center gap-2.5", styles.brand)}
          aria-label="Sculptors home"
        >
          <SculptorsMark className="h-7 w-7 shrink-0" />
          <span className={cn("super-emphasis text-[21px] leading-none tracking-[-0.04em]", labelClass(rail))}>
            Sculptors
          </span>
        </Link>
        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--dashboard-sidebar-text)] transition-colors hover:bg-[var(--dashboard-sidebar-hover)] hover:text-[var(--dashboard-sidebar-text-strong)]"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* The switch is unreadable at 64px but its height is reserved, so the
          nav below sits at the same y whether the rail is open or closed. */}
      <div
        className={cn(
          // Only the fade of labelClass: its truncate is overflow:hidden,
          // which cut the top half off the Ads tag.
          "shrink-0 px-3 pb-2 transition-opacity duration-150",
          rail ? "pointer-events-none opacity-0" : "opacity-100 delay-100"
        )}
        aria-hidden={rail}
      >
        <SidebarSideSwitch />
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pb-4" aria-label="Store navigation">
        {leadItems.map((item) => (
          <RailNavLink key={item.href} item={item} pathname={pathname} rail={rail} onNavigate={onNavigate} />
        ))}
        {/* The lead rows stand apart by a little space, not by a surface. */}
        {leadItems.length > 0 && restItems.length > 0 ? <div className="h-3 shrink-0" aria-hidden="true" /> : null}
        {restItems.map((item) => (
          <RailNavLink key={item.href} item={item} pathname={pathname} rail={rail} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 pb-2.5">
        {footItems.map((item) => (
          <RailNavLink key={item.href} item={item} pathname={pathname} rail={rail} onNavigate={onNavigate} />
        ))}
      </div>
    </aside>
  );
}

export const Sidebar = memo(function Sidebar({
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) {
  const pathname = usePathname();

  const handleClose = useCallback(() => {
    onMobileOpenChange?.(false);
  }, [onMobileOpenChange]);

  return (
    <>
      <GlobalSidebarMenu pathname={pathname} onClose={handleClose} />

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Dashboard navigation">
          <button
            type="button"
            className="absolute inset-0 bg-ink/28"
            aria-label="Close navigation"
            onClick={handleClose}
          />
          <GlobalSidebarMenu pathname={pathname} onClose={handleClose} mobile />
        </div>
      ) : null}
    </>
  );
});

export function MobileNavigationButton({
  onClick,
  title,
}: {
  onClick: () => void;
  title: string;
}) {
  return (
    <div className="mb-2 flex h-12 shrink-0 items-center justify-between rounded-[16px] border border-[var(--dashboard-line)] bg-[var(--color-rail)] px-3 lg:hidden">
      <button
        type="button"
        onClick={onClick}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--dashboard-text)] transition-colors hover:bg-[var(--dashboard-fill-strong)]"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <span className="min-w-0 truncate text-sm font-semibold text-[var(--dashboard-text)]">{title}</span>
      <span className="h-9 w-9" aria-hidden="true" />
    </div>
  );
}
