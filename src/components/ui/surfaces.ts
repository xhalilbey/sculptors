import type { Tone } from '@/components/charts/verdict';

/**
 * The dashboard's shared surfaces.
 *
 * darkCard is the "slightly dimensional" card the owner asked for, after the
 * WorkOS AuthKit tile: a near-black face lit from the top left, a 1px ring
 * that is light where the light lands and fades out at the foot (the
 * padding-box / border-box pair), a faint highlight under the top edge, and
 * a soft shadow that lifts it off the white page. The panels went light for
 * an afternoon and came back to it (owner's direction, 23 Sep 2026).
 *
 * lightCard is the same object on white: a faint top-lit fill, a ring that
 * is darker where the light does not reach, and a soft shadow. No blur
 * anywhere.
 *
 * brandFace is the landing's primary button (.btn-brand in globals.css) as
 * utilities, so it can be sized where it is used: .btn-brand is unlayered
 * CSS and would beat any utility that tried to resize it.
 */

export const darkCard =
  'relative overflow-hidden rounded-[20px] border border-transparent text-white ' +
  '[background:linear-gradient(165deg,#232327_0%,#17171a_55%,#111113_100%)_padding-box,linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))_border-box] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(16,16,18,0.16),0_16px_32px_-18px_rgba(16,16,18,0.55)]';

export const lightCard =
  'relative overflow-hidden rounded-[20px] border border-transparent text-ink ' +
  '[background:linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)_padding-box,linear-gradient(180deg,rgba(25,25,25,0.11),rgba(25,25,25,0.05))_border-box] ' +
  'shadow-[inset_0_1px_0_#ffffff,0_1px_2px_rgba(25,25,25,0.05),0_12px_28px_-18px_rgba(25,25,25,0.28)]';

export const brandFace =
  'text-white [background:linear-gradient(#1f73fd,#4b58e3)] ' +
  'shadow-[inset_0_3.3px_13.3333px_rgba(255,255,255,0.2),inset_0_0.83px_3.33px_#2a3edc]';

export const brandButton =
  `inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-medium ${brandFace} ` +
  'transition-[filter] hover:brightness-110 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]';

/**
 * The band at a tile's foot, holding the number -- on the Store Events
 * Panel's tiles and Agent Suite's cards. On the dark card it is a
 * translucent brand blue, after the WorkOS AuthKit tile -- the look the
 * owner kept. On the light card it is the brand's button blue as a solid
 * surface (--brand-face), which the owner asked for when the cards were
 * light (23 Sep 2026). White text on either keeps at least 5:1.
 */
export const BLUE_BAND: Record<Tone, string> = {
  dark:
    'rounded-[14px] border border-[#6d82ff]/15 ' +
    'bg-[linear-gradient(180deg,rgba(67,89,239,0.22)_0%,rgba(67,89,239,0.08)_100%)] ' +
    'shadow-[inset_0_1px_0_rgba(170,185,255,0.14)]',
  light:
    'rounded-[14px] border border-[#3446dd]/60 [background:var(--brand-face)] ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.24),inset_0_3.3px_13.3333px_rgba(255,255,255,0.12)]',
};

/** The band's caption: muted on the translucent band, full white on the solid one. */
export const BAND_CAPTION: Record<Tone, string> = {
  dark: 'text-white/60',
  light: 'font-medium text-white',
};
