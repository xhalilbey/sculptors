import { Bitcount_Grid_Single, Figtree, Red_Hat_Display } from 'next/font/google';

/*
 * The landing page's two faces (owner's direction, 24 Sep 2026: "improve the
 * fonts, like Groq's"). Groq sets its words in esBuild and its labels in
 * komuna, both licensed; these are the open faces closest to them, picked
 * side by side against groq.com's own rendering:
 *
 * - Figtree for everything read: a warm geometric sans with a round e and o
 *   and a single-storey g, the character of esBuild.
 * - Bitcount Grid Single for labels -- the nav, eyebrows, the footer's small
 *   print: a thin pixel-grid mono, set in capitals and spaced out, which is
 *   what komuna is doing in Groq's nav.
 *
 * Before this the page had no face of its own: the stack named "Super Sans
 * VF", which is not loaded anywhere, and it fell through to the system font.
 *
 * next/font serves both from this origin, so no request leaves for Google at
 * runtime (and a font-src 'self' policy holds).
 */
export const landingSans = Figtree({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-lp-sans',
  display: 'swap',
});

export const landingPixel = Bitcount_Grid_Single({
  subsets: ['latin', 'latin-ext'],
  weight: '300',
  variable: '--font-lp-pixel',
  display: 'swap',
  // next/font has no metrics for this face to size a fallback with, and
  // warns on every compile without this; the fallback is a system mono.
  adjustFontFallback: false,
});

/*
 * The hero's headline face (owner's direction, 24 Sep 2026: the hero text
 * "like Groq Platform"): Groq's display cut is geometric -- circular o's, a
 * G with a long bar, a round-shouldered r. Red Hat Display was the nearest
 * open face in a side-by-side of nine.
 */
export const landingDisplay = Red_Hat_Display({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-lp-display',
  display: 'swap',
});
