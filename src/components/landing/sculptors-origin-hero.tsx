import Image from 'next/image';
import Link from 'next/link';
import { HeroDashboard } from '@/components/landing/hero-dashboard';
import { IsoStage } from '@/components/landing/iso-stage';
import { MarketplaceLogos } from '@/components/landing/marketplace-logos';

const NAV_ITEMS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Agent Store', href: '#agent-store' },
  { label: 'Memory', href: '#memory' },
  { label: 'Integrations', href: '#integrations' },
] as const;

export function SculptorsOriginHero() {
  return (
    <section className="bg-lp-ground" aria-labelledby="sculptors-hero-title">
      <header className="lp-header mx-auto grid h-[76px] w-[min(1540px,calc(100%-64px))] grid-cols-[1fr_auto_1fr] items-center gap-7 max-lg:w-[calc(100%-32px)] max-md:h-[66px] max-md:w-[calc(100%-24px)] max-md:grid-cols-[1fr_auto]">
        <Link href="/" className="flex w-max items-center gap-2.5">
          <Image
            src="/sculptors-icon.png"
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] shrink-0 object-contain brightness-0 [[data-theme=dark]_&]:invert"
            aria-hidden="true"
            priority
          />
          <span className="super-emphasis text-[23px] tracking-[-0.04em] text-lp-ink">Sculptors</span>
        </Link>

        {/* Groq's nav: pixel capitals, and a bar that rises onto the header's
            hairline under the one being pointed at. */}
        <nav className="lp-nav max-md:hidden" aria-label="Primary navigation">
          {NAV_ITEMS.map(item => (
            <a key={item.label} href={item.href} className="lp-nav-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center self-stretch justify-self-end gap-3 text-sm font-semibold">
          <Link href="/auth/login" className="lp-nav-link max-sm:hidden">
            Get started
          </Link>
          <a
            href="https://cal.com/halil-eren-pdniuc/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brand gap-5 transition-colors"
          >
            Book a demo
            <span className="text-[23px] leading-none" aria-hidden="true">
              ›
            </span>
          </a>
        </div>
      </header>

      {/*
        Harvey's shape: the words on plain white, then a painted band crossing
        the page, with the product overlapping it. The slogan, its lede and its
        two buttons are the ones that were already here -- the ground under
        them changed from a sky-blue card to white, nothing else.
      */}
      <div className="hero-copy">
        <h1
          id="sculptors-hero-title"
          className="super-display m-0 text-[clamp(48px,5.2vw,80px)] leading-[0.94] tracking-[-0.045em] text-lp-ink max-md:text-[clamp(44px,12vw,60px)]"
        >
          <span className="block">The Agent Store</span>
          <span className="block">Autonomous Sales Intelligence</span>
        </h1>

        <p className="super-body mt-7 max-w-[920px] text-[clamp(17px,1.35vw,21px)] font-semibold leading-[1.3] tracking-[-0.025em] text-lp-ink/70 max-md:max-w-[420px] max-md:text-[16px]">
          Built for developers: every piece is a primitive you compose yourself, so nothing
          about how your agents sell is decided for you.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {/* Filled, not white: this button was white on a sky-blue card, and
              the card is gone -- white on white left nothing to press. */}
          <Link href="/auth/login" className="btn-brand gap-6 transition-colors max-sm:gap-4">
            Get started
            <span className="text-[24px] leading-none" aria-hidden="true">
              ›
            </span>
          </Link>
          <a
            href="https://cal.com/halil-eren-pdniuc/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost transition-colors"
          >
            Book a demo
          </a>
        </div>
      </div>

      {/*
        HockeyStack's shape (owner's direction, 24 Sep 2026): the product
        lies back on the white and fades into it, and the marketplaces run
        under it. The painted band it stood on before is gone, and the logo
        strip moved down from under the buttons.
      */}
      <IsoStage>
        <HeroDashboard />
      </IsoStage>

      <MarketplaceLogos />
    </section>
  );
}
