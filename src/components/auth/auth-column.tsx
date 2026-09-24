'use client';

import { useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { SculptorsMark } from '@/components/brand/sculptors-mark';
import { cn } from '@/lib/utils';

/**
 * The auth column, after Harvey's (Auth0 universal login, measured 22 Sep
 * 2026): one 320px column centred on a near-black ground, a 52px mark, a
 * 36px heading, an 18.66px line of context, then a single outlined field
 * whose label floats into the border, and a 52px off-white button. No card,
 * no side art, no shadows, 4px radii throughout.
 *
 * Harvey's ground is #0f0e0d and its ink #fafaf9 -- warm, not pure. The
 * muted #8f8b85 carries labels and hairlines. All three are used verbatim.
 *
 * It lives here rather than in the login page because every screen a person
 * meets before the dashboard (login, organization setup, password reset)
 * is the same column with a different single field.
 */

export const GROUND = '#0f0e0d';
export const INK = '#fafaf9';
export const MUTED = '#8f8b85';
export const ERROR = '#d03c38';

export const fieldClassName = cn(
  'peer h-[52px] w-full rounded-[4px] border bg-[#0f0e0d] px-4 text-[16px] leading-none text-[#fafaf9]',
  'outline-none transition-colors placeholder:text-transparent',
  'autofill:shadow-[inset_0_0_0_1000px_#0f0e0d] autofill:[-webkit-text-fill-color:#fafaf9]',
  'disabled:text-[#8f8b85]'
);

export const labelClassName = cn(
  'pointer-events-none absolute left-4 top-1/2 origin-left -translate-y-1/2 bg-[#0f0e0d] px-1.5 py-px',
  'text-[14px] leading-none text-[#8f8b85] transition-all duration-150',
  'peer-focus:top-0 peer-focus:scale-[.88]',
  'peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:scale-[.88]'
);

export const continueClassName = cn(
  'mt-6 flex h-[52px] w-full items-center justify-center rounded-[4px] bg-[#fafaf9] px-4',
  'text-[14px] font-normal text-[#0f0e0d] transition-colors hover:bg-white',
  'disabled:cursor-default disabled:opacity-60'
);

export const quietLinkClassName = 'text-[14px] text-[#8f8b85] transition-colors hover:text-[#fafaf9]';

/**
 * The column fades in over 250ms once the loader leaves, which is Harvey's
 * own transition (their `animate-fade-in`: .25s ease-in-out both). Done
 * with the Web Animations API so it needs no stylesheet.
 */
export function FadeIn({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 250,
      easing: 'ease-in-out',
      fill: 'both',
    });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Harvey's field: the label rests inside the box and, once the field is
 * focused or holds a value, rises to sit on the top border at 88% size with
 * the ground colour behind it so the border appears to break for it.
 */
export function FloatingField({
  label,
  error,
  trailing,
  className,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  error?: string;
  trailing?: ReactNode;
}) {
  const generatedId = useId();
  const id = inputProps.id ?? generatedId;

  return (
    <div>
      <div className="relative">
        <input
          {...inputProps}
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          className={cn(
            fieldClassName,
            error ? 'border-[#d03c38] focus:border-[#d03c38]' : 'border-[#8f8b85] focus:border-[#fafaf9]',
            trailing ? 'pr-12' : null,
            className
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            labelClassName,
            error ? 'text-[#d03c38]' : 'peer-focus:text-[#fafaf9]'
          )}
        >
          {label}
        </label>
        {trailing ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[14px] leading-5" style={{ color: ERROR }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Required() {
  return <span aria-hidden="true">*</span>;
}

/**
 * The whole screen: the ground, then the column -- mark, heading, one line
 * of context -- and whatever the screen asks for under it. `aside` renders
 * on the ground outside the fading column (the login page's toaster).
 */
export function AuthScreen({
  heading,
  subtitle,
  aside,
  children,
}: {
  heading: ReactNode;
  subtitle: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-10 py-12"
      style={{ backgroundColor: GROUND, color: INK }}
    >
      {aside}

      <FadeIn className="w-full max-w-[320px]">
        <div className="flex justify-center">
          <SculptorsMark className="h-[52px] w-[52px]" />
        </div>
        <h1 className="mb-4 mt-6 text-center text-[36px] font-normal leading-[54px]">{heading}</h1>
        <p className="text-center text-[18.66px] font-normal leading-7">{subtitle}</p>

        {children}
      </FadeIn>
    </div>
  );
}
