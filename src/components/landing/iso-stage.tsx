'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

/**
 * The page width the tilted sheet is drawn for. At this width the sheet's far
 * corner and its gauge card land inside the page, as the reference's do; the
 * sheet is scaled by (stage width / ISO_BASE_WIDTH) at any other width.
 */
const ISO_BASE_WIDTH = 1560;

/**
 * The window the hero's dashboard lies in (see .iso-hero in globals.css).
 *
 * Its one job in script is the sheet's scale. CSS cannot turn a width into
 * the plain number `scale()` needs without typed arithmetic, and the
 * `tan(atan2(100cqw, 1560px))` trick that does it in Chromium resolves to a
 * sheet of nothing in Safari 26 -- the owner's Safari showed an empty stage
 * (24 Sep 2026). So the width is measured and the ratio written as a number;
 * the stylesheet's stepped values only cover the first paint.
 */
export function IsoStage({ children }: { readonly children: ReactNode }) {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;

    if (!hero) return;

    const apply = (width: number) => {
      hero.style.setProperty('--iso-scale', String(width / ISO_BASE_WIDTH));
    };

    apply(hero.clientWidth);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) apply(entry.contentRect.width);
    });

    observer.observe(hero);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={heroRef} className="iso-hero">
      <div className="iso-stage">
        <div className="iso-plane">{children}</div>
      </div>
    </div>
  );
}
