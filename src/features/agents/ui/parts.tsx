'use client';

import {
  Blocks,
  BookOpen,
  Check,
  Columns2,
  Compass,
  Feather,
  Fingerprint,
  ListChecks,
  MessageSquareText,
  PackageCheck,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentSection, SkillKey } from '../domain/agent-profile';

/** The small pieces Agent Suite's cards and editors share. */

export const SECTION_ICONS: Record<AgentSection, LucideIcon> = {
  identifier: Fingerprint,
  culture: Feather,
  rules: ListChecks,
  skills: Blocks,
};

export const SKILL_ICONS: Record<SkillKey, LucideIcon> = {
  'product-answers': MessageSquareText,
  catalogs: BookOpen,
  comparisons: Columns2,
  'discovery-pages': Compass,
  'add-to-cart': ShoppingCart,
  'order-support': PackageCheck,
};

export const field =
  'w-full rounded-[10px] border border-[var(--dashboard-line)] bg-[var(--dashboard-field)] px-3 text-[14px] text-[var(--card-text)] ' +
  'outline-none transition-colors placeholder:text-[var(--card-text-faint)] focus:border-[#4f7dff] disabled:opacity-60';

export const fieldLabel = 'block text-[13px] font-medium text-[var(--card-text-soft)]';

export const quietButton =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--dashboard-line)] px-4 text-[13px] font-semibold ' +
  'text-[var(--card-text)] transition-colors hover:bg-[var(--dashboard-fill-strong)] disabled:opacity-50 disabled:hover:bg-transparent';

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]';

/** A section's icon in its small tile, as the cards and the section pages show it. */
export function SectionIcon({ section, size = 'small' }: { section: AgentSection; size?: 'small' | 'large' }) {
  const Icon = SECTION_ICONS[section];

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center border border-[var(--dashboard-line)] bg-[var(--card-fill)] text-[var(--card-text-soft)]',
        size === 'large' ? 'h-11 w-11 rounded-[13px]' : 'h-9 w-9 rounded-[11px]'
      )}
      aria-hidden="true"
    >
      <Icon className={size === 'large' ? 'h-5 w-5' : 'h-[18px] w-[18px]'} strokeWidth={1.75} />
    </span>
  );
}

/** The agent's face: its initial on the brand gradient, as organizations are drawn in Settings. */
export function AgentMark({ name, size }: { name: string; size: 'large' | 'small' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center font-bold text-white [background:var(--brand-face)]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]',
        size === 'large' ? 'h-12 w-12 rounded-[14px] text-[20px]' : 'h-7 w-7 rounded-[9px] text-[12px]'
      )}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || 'A'}
    </span>
  );
}

export function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border',
        selected ? 'border-[#4f7dff] bg-[#4f7dff] text-white' : 'border-[var(--dashboard-line)]'
      )}
      aria-hidden="true"
    >
      {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
    </span>
  );
}

export function Switch({
  checked,
  labelledBy,
  onChange,
}: {
  checked: boolean;
  labelledBy: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors',
        focusRing,
        checked ? 'bg-[#4f7dff]' : 'bg-[var(--dashboard-fill-strong)] shadow-[inset_0_0_0_1px_var(--dashboard-line)]'
      )}
    >
      <span
        className={cn(
          'absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
