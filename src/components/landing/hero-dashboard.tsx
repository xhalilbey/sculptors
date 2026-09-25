'use client';

import { ChevronsUpDown, Megaphone, Search, Store } from 'lucide-react';
import Link from 'next/link';
import { SculptorsMark } from '@/components/brand/sculptors-mark';
import { useLandingTheme } from '@/components/landing/landing-theme';
import { NAVIGATION_GROUPS } from '@/config/constants';
import { OverviewPreview } from '@/features/metrics';

/**
 * The product, laid on the page at an angle -- HockeyStack's hero, where the
 * dashboard is a sheet lying back on the white and fading into it rather
 * than a window standing in a frame (owner's direction, 24 Sep 2026; it
 * stood upright on a painted band before).
 *
 * The sheet is drawn flat at a fixed design size (.iso-dash, 1500x940) and
 * the stylesheet does the rest: it tips it back, turns it, scales it to the
 * page's width and fades its far edge. Nothing in here knows it is tilted.
 *
 * The rail reads NAVIGATION_GROUPS and every entry is a real Link, so the
 * pages a visitor sees are the pages the app has; the main area is the
 * app's real Overview (OverviewPreview) on the app's demo numbers.
 */

export function HeroDashboard() {
  const theme = useLandingTheme();

  return (
    <div className="iso-dash">
      <aside className="iso-rail">
        <div className="iso-rail-brand">
          <SculptorsMark className="h-[22px] w-[22px]" />
          <span>Sculptors</span>
          <ChevronsUpDown aria-hidden="true" />
        </div>

        <div className="iso-rail-search" aria-hidden="true">
          <Search />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </div>

        {/* The rail's two sides, as the app has them: Store open, Ads to come. */}
        <div className="iso-rail-switch" aria-hidden="true">
          <span className="is-active">
            <Store />
            Store
          </span>
          <span>
            <Megaphone />
            Ads
          </span>
        </div>

        {NAVIGATION_GROUPS.map(group => (
          <nav key={group.title} aria-label={group.title} className="iso-rail-nav">
            {group.items.map((item, index) => {
              const ItemIcon = item.icon;
              const isCurrent = index === 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isCurrent ? 'is-active' : item.lead ? 'is-lead' : undefined}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  <ItemIcon aria-hidden="true" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        ))}
      </aside>

      <div className="iso-main">
        <OverviewPreview theme={theme} />
      </div>
    </div>
  );
}
