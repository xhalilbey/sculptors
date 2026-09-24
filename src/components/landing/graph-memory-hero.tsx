'use client';

import { ArrowDown, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';

export function GraphMemoryHero({ children }: { children: ReactNode }) {
  const heroRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const updateProgress = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const hero = heroRef.current;

        if (!hero) return;

        const rect = hero.getBoundingClientRect();
        const travel = Math.max(1, hero.offsetHeight - window.innerHeight);

        setProgress(Math.min(1, Math.max(0, -rect.top / travel)));
      });
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, []);

  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const ease = (value: number) => value * value * (3 - 2 * value);
  const introExit = ease(clamp((progress - 0.3) / 0.28));
  const demoEnter = ease(clamp((progress - 0.28) / 0.28));

  return (
    <section
      ref={heroRef}
      className="relative h-[230svh] min-h-[1560px] bg-canvas"
      aria-labelledby="graph-memory-title"
    >
      <span id="memory-demo" className="absolute top-[112svh]" aria-hidden="true" />

      <div className="sticky top-0 h-svh min-h-[680px] overflow-hidden bg-canvas">
        <nav className="absolute inset-x-0 top-0 z-50 flex w-full items-center justify-between px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/sculptors-icon.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 object-contain brightness-0"
              aria-hidden="true"
              priority
            />
            <span className="super-emphasis text-[17px] tracking-[-0.025em] text-ink md:text-lg">
              Sculptors
            </span>
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/auth/login"
              className="hidden h-11 items-center justify-center rounded-[10px] border border-ink/20 bg-canvas/92 px-5 text-sm font-semibold text-ink transition-colors hover:border-ink/48 sm:inline-flex"
            >
              Log in
            </Link>
            <a
              href="https://cal.com/halil-eren-pdniuc/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-ink px-5 text-sm font-semibold text-ink-inverse transition-colors hover:bg-ink sm:px-6"
            >
              Book a demo
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </nav>

        <div
          className="absolute inset-0 flex items-center justify-center px-5 pb-12 pt-24 text-center sm:px-8"
          style={{
            opacity: 1 - introExit,
            transform: `translate3d(0, ${-90 * introExit}px, 0) scale(${1 - 0.04 * introExit})`,
            filter: `blur(${16 * introExit}px)`,
            pointerEvents: introExit > 0.92 ? 'none' : 'auto',
          }}
        >
          <div className="mx-auto flex max-w-[1260px] flex-col items-center">
            <h1
              id="graph-memory-title"
              className="graph-memory-editorial text-[clamp(58px,8.7vw,132px)] leading-[0.9] text-ink"
            >
              Every customer
              <br />
              remembered in
              <br />
              one living graph.
            </h1>

            <div className="mt-8 flex flex-wrap justify-center gap-3 sm:mt-10">
              <a
                href="#memory-demo"
                className="inline-flex h-12 items-center justify-center rounded-[8px] bg-ink px-6 text-sm font-semibold text-ink-inverse transition-colors hover:bg-ink sm:h-14 sm:px-7 sm:text-base"
              >
                See memory in action
              </a>
              <Link
                href="/auth/login"
                className="inline-flex h-12 items-center justify-center rounded-[8px] border border-ink bg-canvas px-6 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 sm:h-14 sm:px-7 sm:text-base"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>

        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_62%,rgba(212,200,255,0.5),rgba(248,246,241,0)_42%)]"
          style={{
            opacity: demoEnter,
            transform: `translate3d(0, ${110 * (1 - demoEnter)}px, 0) scale(${0.95 + 0.05 * demoEnter})`,
            filter: `blur(${14 * (1 - demoEnter)}px)`,
            pointerEvents: demoEnter > 0.92 ? 'auto' : 'none',
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-20 flex items-end justify-center">
            <Image
              src="/hero/sculptors-thinking-japanese-woman-transparent-v1.png"
              alt="A thoughtful customer intelligence strategist considering connected customer signals"
              width={1024}
              height={1536}
              sizes="(min-width: 1024px) 520px, 72vw"
              className="h-[min(74svh,760px)] w-auto max-w-[72vw] select-none object-contain object-bottom drop-shadow-[0_30px_46px_rgba(55,48,84,0.18)]"
              quality={100}
              unoptimized
              priority
            />
          </div>

          {children}
        </div>

        <a
          href="#memory-demo"
          className="absolute bottom-8 left-5 z-40 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/52 transition-colors hover:text-ink sm:left-8 lg:left-12"
          style={{ opacity: 1 - introExit }}
        >
          Scroll to explore
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
