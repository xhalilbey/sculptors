'use client';

import { useEffect } from 'react';

/**
 * Scroll-reveal driver, ported from legathon-tanitim and, through it, from
 * Bending Spoons' page: sections and cards arrive as they enter the viewport
 * instead of sitting there fully drawn. Anything with `data-reveal` is armed
 * (hidden, see the reveal rules in globals.css) and watched; on first
 * intersection it gets `.is-visible` and is let go.
 *
 * Hiding is per element and only ever done here, so markup this driver never
 * saw (no JavaScript, a render before hydration, a node inserted later by
 * Fast Refresh or conditional rendering) stays visible. The page is never
 * blank. A MutationObserver arms elements that appear after mount.
 */
export function RevealObserver() {
  useEffect(() => {
    const reveals = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add('is-visible');
          reveals.unobserve(entry.target);
        }
      },
      // Fire a little before the element's top clears the fold, so the
      // motion is already underway when the eye lands on it.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );

    const arm = (el: Element) => {
      if (el.classList.contains('reveal-armed') || el.classList.contains('is-visible')) {
        return;
      }

      el.classList.add('reveal-armed');
      reveals.observe(el);
    };

    const armWithin = (root: ParentNode) => {
      if (root instanceof Element && root.matches('[data-reveal]')) {
        arm(root);
      }

      root.querySelectorAll('[data-reveal]').forEach(arm);
    };

    armWithin(document.body);

    const additions = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) {
            armWithin(node);
          }
        });
      }
    });

    additions.observe(document.body, { childList: true, subtree: true });

    return () => {
      additions.disconnect();
      reveals.disconnect();
      // Leave nothing hidden behind: the driver is gone, so is the hiding.
      document.querySelectorAll('.reveal-armed').forEach(el => el.classList.remove('reveal-armed'));
    };
  }, []);

  return null;
}
