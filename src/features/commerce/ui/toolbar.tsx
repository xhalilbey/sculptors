'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { Dropdown } from '@/components/ui/dropdown';
import { cn } from '@/lib/utils';

/** The search, the filter chips and the menus the Products, Customers and Orders pages share. */

export const control =
  'inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--dashboard-line)] px-3.5 text-[14px] font-medium ' +
  'text-[var(--dashboard-text)] transition-colors hover:bg-[var(--dashboard-fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]';

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (next: string) => void; placeholder: string }) {
  return (
    <label className="relative">
      <span className="sr-only">{placeholder}</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dashboard-text-muted)]"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-[260px] max-w-full rounded-[10px] border border-[var(--dashboard-line)] bg-transparent pl-9 pr-3 text-[14px] text-[var(--dashboard-text)] outline-none transition-colors placeholder:text-[var(--dashboard-text-muted)] focus:border-[#4f7dff]"
      />
    </label>
  );
}

/** One choice among a few, as a row of pills; each can carry a count. */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]',
              active
                ? 'border-[var(--dashboard-text)] bg-[var(--dashboard-text)] text-[var(--dashboard-panel)]'
                : 'border-[var(--dashboard-line)] text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-fill)] hover:text-[var(--dashboard-text)]'
            )}
          >
            {option.label}
            {option.count !== undefined ? <span className={cn('tabular-nums', active ? 'opacity-70' : 'opacity-60')}>{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A menu that picks one value: a sort, a stock level, a country. */
export function PickMenu<T extends string>({
  label,
  options,
  value,
  onChange,
  align = 'start',
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  align?: 'start' | 'end';
}) {
  const current = options.find((option) => option.value === value);

  return (
    <Dropdown
      align={align}
      buttonClassName={control}
      button={
        <>
          <span className="text-[var(--dashboard-text-muted)]">{label}:</span>
          {current?.label}
          <ChevronDown className="h-4 w-4 text-[var(--dashboard-text-muted)]" aria-hidden="true" />
        </>
      }
    >
      {(close) => (
        <div role="menu" aria-label={label} className="max-h-[320px] overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => {
                onChange(option.value);
                close();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-[var(--dashboard-fill)]"
            >
              {option.label}
              {option.value === value ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

/** "36 products", under the toolbar's right edge. */
export function ResultCount({ shown, total, noun }: { shown: number; total: number; noun: [string, string] }) {
  const word = (count: number) => (count === 1 ? noun[0] : noun[1]);

  return (
    <p className="text-[13px] tabular-nums text-[var(--dashboard-text-muted)]">
      {shown === total ? `${total} ${word(total)}` : `${shown} of ${total} ${word(total)}`}
    </p>
  );
}

/** The error line with a retry, as the other panels show it. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[var(--dashboard-line)] bg-[var(--dashboard-fill)] px-5 py-4">
      <p className="text-[14px] text-[var(--dashboard-text-muted)]">{message}</p>
      <button type="button" onClick={onRetry} className={control}>
        Try again
      </button>
    </div>
  );
}

/** Nothing matched: say so, and offer the way back. */
export function NoMatches({ noun, onClear }: { noun: string; onClear: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-[16px] border border-dashed border-[var(--dashboard-line)] py-14 text-center">
      <p className="text-[14px] text-[var(--dashboard-text-muted)]">No {noun} match these filters.</p>
      <button type="button" onClick={onClear} className="mt-2 text-[13px] font-medium text-[var(--dashboard-text)] underline underline-offset-2">
        Clear filters
      </button>
    </div>
  );
}
