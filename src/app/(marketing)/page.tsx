'use client';

import {
  Car,
  ChevronDown,
  Palette,
  Plane,
  Store,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AgentJourney } from '@/components/landing/agent-journey';
import { Engines } from '@/components/landing/engines';
import { landingDisplay, landingPixel, landingSans } from '@/components/landing/fonts';
import { GraphMemoryHero } from '@/components/landing/graph-memory-hero';
import { useLandingTheme } from '@/components/landing/landing-theme';
import { RevealObserver } from '@/components/landing/reveal-observer';
import { SculptorsOriginHero } from '@/components/landing/sculptors-origin-hero';
import { SiteFooter } from '@/components/landing/site-footer';

type LandingHeroVariant = 'origin' | 'graph-memory' | 'legacy-woman';
const LANDING_HERO_VARIANT = (process.env.NEXT_PUBLIC_LANDING_HERO_VARIANT ??
  'origin') as LandingHeroVariant;

type HeroExchange = {
  user: string;
  agent: string;
  memory: {
    title: string;
    detail: string;
    evidence: string;
    shimmerWidth: number;
  };
};

type HeroChatMessage = {
  id: string;
  role: 'user' | 'agent';
  text: string;
};

type HeroMemorySlot = {
  id: string;
  memory: HeroExchange['memory'];
  state: 'shimmer' | 'ready';
};

const HERO_FLOW_STEPS = [
  {
    label: 'E commerce',
    icon: Store,
    turnText:
      'A repeat buyer asks whether the new running shoe is worth switching to after browsing twice and abandoning cart.',
    memoryMeta: 'Customer intent forming',
    exchanges: [
      {
        user: 'Is CloudSwift Runner better for daily runs?',
        agent:
          'Recommend CloudSwift Runner with the lightweight fit angle. Mention that it pairs well with the recovery socks she already bought.',
        memory: {
          title: 'Product-fit intent',
          detail:
            'Customer is evaluating CloudSwift Runner for daily runs, not looking for a discount yet.',
          evidence: 'Turn: shoe comparison + abandoned cart',
          shimmerWidth: 86,
        },
      },
      {
        user: 'What should we say next?',
        agent:
          'Send a short WhatsApp comparison after 6 PM, then add a soft bundle suggestion without leading with a discount.',
        memory: {
          title: 'Channel timing',
          detail: 'Best outreach window is WhatsApp after 6 PM with a concise comparison message.',
          evidence: 'Turn: asks for next message',
          shimmerWidth: 76,
        },
      },
      {
        user: 'Do we need a discount?',
        agent:
          'Not yet. Her intent is product-fit driven, so lead with comfort, use case, and the matching set.',
        memory: {
          title: 'Price sensitivity',
          detail:
            'Do not lead with promotion; comfort, use case, and matching set are stronger drivers.',
          evidence: 'Turn: discount question',
          shimmerWidth: 82,
        },
      },
    ] satisfies HeroExchange[],
  },
  {
    label: 'Beauty',
    icon: Palette,
    turnText:
      'A shopper asks for a simple brightening routine after opening two serum campaigns and buying a gentle cleanser.',
    memoryMeta: 'Routine memory forming',
    exchanges: [
      {
        user: 'What should I add after cleanser?',
        agent:
          'Recommend the fragrance-free vitamin C serum as the next step. Keep the tone consultative and routine-led.',
        memory: {
          title: 'Routine stage',
          detail:
            'Customer is building a simple brightening routine after cleanser and needs a next-step serum.',
          evidence: 'Turn: asks after cleanser',
          shimmerWidth: 88,
        },
      },
      {
        user: 'Should we push a bundle?',
        agent:
          'Suggest cleanser plus serum as a two-step routine, but avoid sounding promotional. She is asking for guidance first.',
        memory: {
          title: 'Selling style',
          detail:
            'Use advisory language; she responds to guidance before bundles or promotional framing.',
          evidence: 'Turn: bundle hesitation',
          shimmerWidth: 78,
        },
      },
      {
        user: 'What is the safest message?',
        agent:
          'Frame it as a starter routine: cleanse, apply serum, moisturize. Offer help choosing frequency if her skin is sensitive.',
        memory: {
          title: 'Care constraint',
          detail:
            'Keep routine gentle and mention frequency support for sensitive skin before upsell language.',
          evidence: 'Turn: safest message',
          shimmerWidth: 84,
        },
      },
    ] satisfies HeroExchange[],
  },
  {
    label: 'Automotive',
    icon: Car,
    turnText:
      'A lead compares two compact SUVs and asks whether the hybrid upgrade is worth it for school runs and weekend trips.',
    memoryMeta: 'Lead context forming',
    exchanges: [
      {
        user: 'Is the hybrid trim worth it?',
        agent:
          'Recommend the compact hybrid trim. Lead with monthly fuel savings, then explain cargo space for family use.',
        memory: {
          title: 'Decision criteria',
          detail:
            'Lead cares about monthly fuel savings and family cargo utility more than feature volume.',
          evidence: 'Turn: hybrid upgrade question',
          shimmerWidth: 83,
        },
      },
      {
        user: 'How should sales follow up?',
        agent:
          'Offer a Saturday test drive and include a simple side-by-side cost comparison before asking for a commitment.',
        memory: {
          title: 'Next action',
          detail:
            'Offer Saturday test drive with a side-by-side cost comparison; lead is still in evaluation mode.',
          evidence: 'Turn: sales follow-up',
          shimmerWidth: 90,
        },
      },
      {
        user: 'Should we mention financing?',
        agent:
          'Mention financing only after the test-drive offer. Their first objection is value, not payment mechanics.',
        memory: {
          title: 'Objection order',
          detail: 'Answer value and operating-cost concern before introducing financing mechanics.',
          evidence: 'Turn: financing question',
          shimmerWidth: 74,
        },
      },
    ] satisfies HeroExchange[],
  },
  {
    label: 'Travel',
    icon: Plane,
    turnText:
      'A family searches two city breaks, saves three hotels, and asks for the easiest weekend option with low planning friction.',
    memoryMeta: 'Trip intent forming',
    exchanges: [
      {
        user: 'Which weekend trip is easiest?',
        agent:
          'Recommend Lisbon. It has direct flights, saved hotels, and the clearest family-friendly itinerary.',
        memory: {
          title: 'Trip fit',
          detail:
            'Lisbon is the lowest-friction option because direct flights and saved hotels already match the family plan.',
          evidence: 'Turn: easiest weekend trip',
          shimmerWidth: 92,
        },
      },
      {
        user: 'What should we send them?',
        agent:
          'Send a two-day itinerary with three hotel options and one flexible booking window. Keep it easy to approve.',
        memory: {
          title: 'Offer format',
          detail:
            'Send a two-day family itinerary with three mid-range hotels and one flexible booking window.',
          evidence: 'Turn: package request',
          shimmerWidth: 86,
        },
      },
      {
        user: 'Should we include upgrades?',
        agent:
          'Keep upgrades secondary. Lead with convenience, direct flights, and the saved hotel shortlist.',
        memory: {
          title: 'Priority signal',
          detail:
            'Convenience should lead the pitch; upgrades are secondary until the core plan is accepted.',
          evidence: 'Turn: upgrade question',
          shimmerWidth: 78,
        },
      },
    ] satisfies HeroExchange[],
  },
] as const;

function useHeroFlowPlayback(exchanges: readonly HeroExchange[]) {
  const [tick, setTick] = useState(-1);
  const maxTick = exchanges.length * 3 - 1;

  useEffect(() => {
    const startTimer = window.setTimeout(() => setTick(0), 220);

    return () => window.clearTimeout(startTimer);
  }, [exchanges.length]);

  useEffect(() => {
    if (tick < 0 || tick >= maxTick) {
      return;
    }

    const phase = tick % 3;
    const delay = phase === 0 ? 560 : phase === 1 ? 760 : 1150;
    const timer = window.setTimeout(() => setTick(value => value + 1), delay);

    return () => window.clearTimeout(timer);
  }, [tick, maxTick]);

  const chat: HeroChatMessage[] = [];
  const memorySlots: HeroMemorySlot[] = [];

  for (const [index, exchange] of exchanges.entries()) {
    const base = index * 3;

    if (tick < base) {
      break;
    }

    chat.push({ id: `${index}-user`, role: 'user', text: exchange.user });

    if (tick < base + 1) {
      memorySlots.push({
        id: `${index}-memory`,
        memory: exchange.memory,
        state: 'shimmer',
      });
      break;
    }

    memorySlots.push({
      id: `${index}-memory`,
      memory: exchange.memory,
      state: 'ready',
    });

    if (tick < base + 2) {
      break;
    }

    chat.push({ id: `${index}-agent`, role: 'agent', text: exchange.agent });
  }

  const showTyping = tick >= 0 && tick % 3 === 1 && tick < maxTick;
  const isFormingMemory = memorySlots.some(slot => slot.state === 'shimmer');
  const isComplete = tick >= maxTick;

  return { chat: chat.slice(-4), memorySlots, showTyping, isFormingMemory, isComplete };
}

export default function LandingPage() {
  const [activeHeroFlowIndex, setActiveHeroFlowIndex] = useState(0);
  // The index only ever comes from this list, so the fallback never shows.
  const activeHeroFlow = HERO_FLOW_STEPS[activeHeroFlowIndex] ?? HERO_FLOW_STEPS[0];
  // Light or dark, chosen in the footer; globals.css swaps the landing's
  // --color-lp-* tokens under data-theme="dark".
  const landingTheme = useLandingTheme();

  // No session check here: the landing page is public and static. A visitor
  // with a session cookie is redirected into the app by the proxy
  // (src/middleware.ts) before this renders.

  return (
    <div
      className={`landing-night ${landingSans.variable} ${landingPixel.variable} ${landingDisplay.variable} min-h-screen w-full overflow-x-hidden bg-lp-ground text-lp-ink selection:bg-lp-ink selection:text-lp-ground`}
      data-theme={landingTheme}
    >
      <RevealObserver />

      {LANDING_HERO_VARIANT === 'graph-memory' ? (
        <GraphMemoryHero>
          <HeroFloatingElements
            key={activeHeroFlowIndex}
            activeStep={activeHeroFlow}
            activeIndex={activeHeroFlowIndex}
            onStepChange={setActiveHeroFlowIndex}
          />
        </GraphMemoryHero>
      ) : LANDING_HERO_VARIANT === 'origin' ? (
        <SculptorsOriginHero />
      ) : (
        <div className="relative isolate overflow-hidden bg-white">
          <div className="pointer-events-none absolute inset-0 z-0">
            <Image
              src="/hero/sculptors-clay-river-hero.png"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-bottom"
              quality={100}
              unoptimized
              aria-hidden="true"
              priority
            />
          </div>

          {/* 1. DARK HERO SECTION */}
          <div className="relative z-10 min-h-[clamp(900px,62vw,1180px)] w-full overflow-hidden pb-12 md:pb-14">
            {/* Navigation */}
            <div className="absolute inset-x-0 top-6 z-50 pointer-events-none md:top-8">
              <nav className="flex w-full items-center justify-between bg-transparent px-4 py-2 pointer-events-auto sm:px-6 lg:px-8">
                <Link href="/" className="flex shrink-0 items-center gap-2">
                  <Image
                    src="/sculptors-icon.png"
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain brightness-0 invert opacity-95"
                    aria-hidden="true"
                    priority
                  />
                  <span className="super-emphasis text-base tracking-tight text-caution drop-shadow-[0_1px_14px_rgba(72,88,110,0.14)] md:text-lg">
                    Sculptors
                  </span>
                </Link>

                <div className="flex shrink-0 items-center gap-2 md:gap-3">
                  <Link
                    href="/auth/login"
                    className="hidden items-center justify-center whitespace-nowrap rounded-[10px] bg-caution-soft px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-raised md:inline-flex lg:px-5 lg:text-sm"
                  >
                    Get started
                  </Link>
                  <a
                    href="https://cal.com/halil-eren-pdniuc/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] bg-ink px-4 py-2 text-xs font-semibold text-ink-inverse transition-colors hover:bg-ink lg:px-5 lg:text-sm"
                  >
                    Book a demo
                  </a>
                </div>
              </nav>
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start px-4 pt-20 text-left sm:items-center sm:px-6 sm:pt-24 sm:text-center md:pt-28">
              <h1 className="super-display mb-2 max-w-5xl text-4xl text-caution drop-shadow-[0_1px_14px_rgba(72,88,110,0.14)] sm:text-[44px] md:text-[48px] lg:text-[50px]">
                The Agent Store
                <br />
                <span className="whitespace-nowrap">Autonomous Sales Intelligence</span>
              </h1>

              <p className="super-body mb-5 max-w-none text-base text-caution drop-shadow-[0_1px_14px_rgba(72,88,110,0.14)] md:whitespace-nowrap lg:text-lg">
                Built for developers: every piece is a primitive you compose yourself, so
                nothing about how your agents sell is decided for you.
              </p>
            </div>

            <HeroFloatingElements
              key={activeHeroFlowIndex}
              activeStep={activeHeroFlow}
              activeIndex={activeHeroFlowIndex}
              onStepChange={setActiveHeroFlowIndex}
            />
          </div>
        </div>
      )}

      {/* How the agent sells: before the message, in the conversation, after
          the sale (agent-journey.tsx). It replaced the agent's cards, the
          store's parts and the action row on 24 Sep 2026. */}
      <AgentJourney />

      {/* Our in-house engines (engines.tsx), where the action row was. */}
      <Engines />

      {/* 9. FAQ SECTION */}
      <section
        id="faq"
        className="relative scroll-mt-24 overflow-hidden bg-lp-ground px-4 py-16 sm:px-6 md:py-20"
      >
        <div className="relative mx-auto max-w-5xl">
          <h2 className="super-heading mb-8 text-center text-4xl text-lp-ink md:text-5xl">FAQ</h2>
          <div className="overflow-hidden rounded-[24px] border border-lp-ink/8 bg-lp-raised px-5 py-2 sm:px-7 md:px-8">
            {(
              [
                {
                  q: 'How is this different from analytics dashboards?',
                  a: 'Dashboards show what happened. Sculptors collects customer events, turns them into customer intelligence, and gives sales agents the context to decide who to reach, what to offer, and which action to take next.',
                },
                {
                  q: 'Which systems can Sculptors connect to?',
                  a: 'Sculptors is designed for tools like Slack, Mixpanel, Amplitude, storefront systems, Meta Ads, Google Ads, TikTok Ads, Firebase, Supabase, Stripe, HubSpot, Intercom, Zendesk, Notion, app stores, CRM systems, and lifecycle messaging platforms.',
                },
                {
                  q: 'What can Sculptors sales agents do?',
                  a: 'Agents can identify purchase intent, build customer segments, prepare campaigns, recommend products, follow up through WhatsApp or SMS, recover at-risk customers, and help teams convert customer insight into sales.',
                },
                {
                  q: 'Is Sculptors only for reporting?',
                  a: 'No. Sculptors can explain performance, but its purpose is action: launching campaigns, preparing personalized messages and offers, guiding customer conversations, and helping sales teams create measurable revenue.',
                },
              ] as { q: string; a: string }[]
            ).map((item, i) => (
              <FaqItem key={i} question={item.q} answer={item.a} defaultOpen={i === 0} />
            ))}
          </div>
          <p className="mt-6 text-center text-base font-medium text-lp-ink/65 md:text-lg">
            Can&apos;t find an answer to your question?{' '}
            <a
              href="https://cal.com/halil-eren-pdniuc/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-lp-ink hover:text-lp-ink/75"
            >
              Get in touch
            </a>
          </p>
        </div>
      </section>

      {/* 10. FOOTER CTA */}
      <section className="bg-lp-ground py-32 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="super-heading mb-8 text-5xl text-lp-ink md:text-7xl">
            Put every customer at your fingertips.
            <br />
            <span className="text-lp-ink/65">
              Turn customer events into insight. Turn insight into sales.
            </span>
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center rounded-[10px] bg-lp-ink px-8 py-2.5 text-sm font-semibold text-lp-ground transition-opacity hover:opacity-85 sm:w-auto md:px-10 md:py-3 md:text-base"
            >
              Get started
            </Link>
            <a
              href="https://cal.com/halil-eren-pdniuc/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-[10px] border border-lp-ink/20 bg-lp-ground px-8 py-2.5 text-sm font-semibold text-lp-ink transition-colors hover:bg-lp-ink/5 sm:w-auto md:px-10 md:py-3 md:text-base"
            >
              Book a demo
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function HeroFloatingElements({
  activeStep,
  activeIndex,
  onStepChange,
  bounded = false,
}: {
  activeStep: (typeof HERO_FLOW_STEPS)[number];
  activeIndex: number;
  onStepChange: (index: number) => void;
  bounded?: boolean;
}) {
  const ActiveIcon = activeStep.icon;
  const { chat, memorySlots, showTyping, isFormingMemory, isComplete } = useHeroFlowPlayback(
    activeStep.exchanges
  );

  useEffect(() => {
    if (!isComplete) {
      return;
    }

    const timer = window.setTimeout(() => {
      onStepChange((activeIndex + 1) % HERO_FLOW_STEPS.length);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [activeIndex, isComplete, onStepChange]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block" aria-hidden="true">
      <div
        className={`absolute flex items-start gap-5 ${bounded ? 'right-8 top-[40%]' : 'left-[max(2rem,calc((100vw-1280px)/2+1rem))] top-[335px]'}`}
      >
        <div
          className={`hero-glass-card flex flex-col overflow-hidden rounded-[24px] p-5 ${bounded ? 'max-h-[310px] w-[330px]' : 'w-[352px]'}`}
        >
          <div className="mb-4 flex shrink-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line/28">
              <ActiveIcon className="h-[18px] w-[18px] text-ink-inverse" strokeWidth={1.65} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink-inverse">Memories</p>
              <p className="text-[11px] font-medium text-ink-inverse/46">{activeStep.label}</p>
            </div>
          </div>

          <p className="max-w-[304px] shrink-0 text-[16px] font-normal leading-[1.42] tracking-[-0.02em] text-ink-inverse">
            {activeStep.turnText}
          </p>

          <div className="mt-5 shrink-0">
            <p className="text-[11px] font-medium text-ink-inverse/50">
              {isFormingMemory ? 'Extracting from conversation…' : activeStep.memoryMeta}
            </p>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-hidden">
            {memorySlots.map((slot, index) => (
              <div
                key={`${activeIndex}-${slot.id}`}
                className={`hero-memory-item px-3.5 py-2.5 ${
                  slot.state === 'ready' ? 'hero-memory-item--ready' : ''
                }`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {slot.state === 'shimmer' ? (
                  <div className="hero-memory-shimmer space-y-2" aria-hidden="true">
                    <div
                      className="hero-memory-shimmer-bar h-2 rounded-full"
                      style={{ width: `${slot.memory.shimmerWidth}%` }}
                    />
                    <div
                      className="hero-memory-shimmer-bar h-2 rounded-full"
                      style={{ width: `${Math.max(44, slot.memory.shimmerWidth - 24)}%` }}
                    />
                    <div
                      className="hero-memory-shimmer-bar h-2 rounded-full"
                      style={{ width: `${Math.max(34, slot.memory.shimmerWidth - 38)}%` }}
                    />
                  </div>
                ) : (
                  <div className="hero-memory-text">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-inverse/44">
                        Turn memory
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-raised/58" />
                    </div>
                    <p className="text-[12px] font-semibold leading-tight text-ink-inverse">
                      {slot.memory.title}
                    </p>
                    <p className="mt-1 text-[11px] font-medium leading-snug text-ink-inverse/74">
                      {slot.memory.detail}
                    </p>
                    <p className="mt-1 text-[9px] font-medium leading-none text-ink-inverse/38">
                      {slot.memory.evidence}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="hero-glass-card pointer-events-auto flex flex-col gap-1 rounded-[999px] px-2 py-2.5">
          {HERO_FLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeIndex;

            return (
              <button
                key={step.label}
                type="button"
                title={step.label}
                onClick={() => onStepChange(index)}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 ${
                  isActive
                    ? 'hero-nav-icon--active text-ink-inverse'
                    : 'text-ink-inverse/52 hover:bg-raised/[0.06] hover:text-ink-inverse/78'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.65} />
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`absolute ${bounded ? 'bottom-8 right-8' : 'right-[max(2rem,calc((100vw-1280px)/2+1rem))] top-[410px]'}`}
      >
        <div
          className={`hero-glass-card flex w-[388px] flex-col overflow-hidden rounded-[24px] p-5 ${bounded ? 'max-h-[230px] w-[330px]' : 'max-h-[340px]'}`}
        >
          <div className="mb-3 flex shrink-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line/28">
              <ActiveIcon className="h-[18px] w-[18px] text-ink-inverse" strokeWidth={1.65} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink-inverse">Agent Store</p>
              <p className="text-[11px] font-medium text-ink-inverse/46">{activeStep.label}</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
            {chat.map(message =>
              message.role === 'user' ? (
                <div
                  key={`${activeIndex}-${message.id}`}
                  className="hero-chat-bubble hero-chat-user ml-auto max-w-[82%]"
                >
                  {message.text}
                </div>
              ) : (
                <p
                  key={`${activeIndex}-${message.id}`}
                  className="hero-chat-bubble hero-chat-agent max-w-[94%] text-[13px] font-normal leading-[1.55] text-ink-inverse"
                >
                  {message.text}
                </p>
              )
            )}

            {showTyping && (
              <div className="hero-chat-typing mt-auto flex items-center gap-1.5 px-1 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-raised/78" />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-raised/58"
                  style={{ animationDelay: '120ms' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-raised/42"
                  style={{ animationDelay: '240ms' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({
  question,
  answer,
  defaultOpen = false,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-lp-ink/10 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-6 py-4 text-left text-lp-ink md:py-5"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="text-base font-semibold leading-snug text-lp-ink md:text-lg">{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-lp-ink/55 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="max-w-4xl pb-5 text-sm font-medium leading-relaxed text-lp-ink/65 md:text-base">
          {answer}
        </div>
      )}
    </div>
  );
}
