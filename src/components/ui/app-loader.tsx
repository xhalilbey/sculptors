import { SculptorsMark } from '@/components/brand/sculptors-mark';
import { cn } from '@/lib/utils';

/**
 * The opening loader, after Harvey's (read from their bundle and stylesheet,
 * 22 Sep 2026, and checked against a screenshot of it running).
 *
 * A 96px tile with the mark inside. Behind it, a blurred disc on a 128px
 * frame spins once a second; the tile's outer layer is a 2px translucent
 * ring, so the disc is only ever seen through that ring and the corners --
 * as a soft shadow travelling around the tile's edge. Nothing else moves.
 *
 * Harvey shows this at every boundary where the app has not decided yet:
 * before the session check resolves, as the Suspense fallback, while it
 * hands off to its login. It shows it in the app's theme, which for a
 * visitor is light -- white ground, warm-grey tile, a dark disc -- and only
 * then sends them to its dark login. So the light tone is the one that
 * matches what people actually see, and it is the default here.
 *
 * The colours are Harvey's own tokens, non-reskin (the reskin gate is off
 * before login): ground 0 0% 100%, tile 40 16% 96%, ring 40 100% 10% / .04,
 * disc 40 6% 10%, mark = text colour 40 6% 10%. The dark tone uses their
 * reskin.dark set (a white disc) because their plain dark set puts a
 * near-black disc on a near-black ground and the sweep cannot be seen.
 *
 * The tile itself is ours (owner's direction, 23 Sep 2026: give the one in
 * the middle dimension): it is a raised key like the rail's and the panel's
 * cards -- lit from the top, a white highlight under its top edge, a soft
 * shadow lifting it off the ground -- with the app icon's rounder corners
 * (22px outside, 20px inside, so the ring the sweep shows through stays
 * 2px). Harvey's flat 6px / 4px tile read as a sticker next to the rest of
 * the app.
 */
const TONES = {
  light: {
    ground: 'bg-[hsl(0_0%_100%)]',
    ring: 'bg-[hsl(40_100%_10%/.04)]',
    tile:
      '[background:linear-gradient(180deg,#ffffff_0%,hsl(40_16%_94%)_100%)] ' +
      'shadow-[inset_0_1px_0_#ffffff,inset_0_-1px_0_rgba(25,25,25,0.05)]',
    lift: 'shadow-[0_1px_2px_rgba(25,25,25,0.08),0_18px_34px_-14px_rgba(25,25,25,0.34)]',
    glow: 'bg-[hsl(40_6%_10%)]',
    mark: 'text-[hsl(40_6%_10%)]',
  },
  dark: {
    ground: 'bg-[hsl(30_7%_5%)]',
    ring: 'bg-[hsl(0_0%_100%/.08)]',
    tile:
      '[background:linear-gradient(180deg,hsl(43_7%_23%)_0%,hsl(43_7%_15%)_100%)] ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
    lift: 'shadow-[0_1px_2px_rgba(0,0,0,0.6),0_18px_34px_-14px_rgba(0,0,0,0.9)]',
    glow: 'bg-[hsl(0_0%_100%)]',
    mark: 'text-[hsl(0_0%_100%)]',
  },
} as const;

export function AppLoader({
  tone = 'light',
  fullscreen = true,
  label = 'Loading',
}: {
  tone?: keyof typeof TONES;
  fullscreen?: boolean;
  label?: string;
}) {
  const colors = TONES[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      data-app-loader={tone}
      className={cn(
        'flex items-center justify-center',
        // Inside a panel it takes the panel's own ground.
        fullscreen ? cn('fixed inset-0 z-50 h-screen w-screen', colors.ground) : 'min-h-full flex-1'
      )}
    >
      <div className={cn('relative h-24 w-24 overflow-hidden rounded-[22px]', colors.lift)}>
        <div className="absolute inset-0 flex h-32 w-32 animate-spin items-end justify-end">
          <div className={cn('-m-8 h-24 w-24 rounded-full blur-lg', colors.glow)} />
        </div>
        <div className={cn('absolute inset-0 h-24 w-24 p-0.5', colors.ring)}>
          <div className={cn('flex h-full w-full items-center justify-center rounded-[20px]', colors.tile)}>
            <SculptorsMark className={cn('h-12 w-12', colors.mark)} />
          </div>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
