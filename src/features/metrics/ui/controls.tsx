'use client';

import { brandFace } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';

/**
 * A row of mutually exclusive choices (a bucket size). The chosen one wears
 * the brand button's face; the rest are quiet text on the track.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string; title?: string; disabled?: boolean }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 rounded-full border border-[var(--dashboard-line)] bg-[var(--dashboard-fill)] p-1">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]',
              'disabled:cursor-default disabled:opacity-35',
              selected ? brandFace : 'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
