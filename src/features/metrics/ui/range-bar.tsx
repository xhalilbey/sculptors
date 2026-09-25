'use client';

import { CalendarDays } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { brandButton } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { customRangeProblem, dateOf, type IsoDate, type RangeSelection } from '../domain/time';
import { formatDays } from './format';
import { PRESET_OPTIONS } from './ranges';

const noSubscription = () => () => undefined;

/** Today's UTC date on the client (the native picker's last day), nothing on the server. */
function useToday(): IsoDate | null {
  return useSyncExternalStore(
    noSubscription,
    () => dateOf(new Date()),
    () => null
  );
}

/**
 * The days a panel covers, after RevenueCat's range bar: one connected strip
 * -- Custom, Today, Yesterday, 7D, 30D, 3M, 6M, 12M -- with the chosen
 * segment pressed in. Custom opens two date fields; once applied, the
 * segment shows the chosen days instead of the word.
 */
export function RangeBar({
  selection,
  onChange,
}: {
  selection: RangeSelection;
  onChange: (next: RangeSelection) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const custom = 'from' in selection ? selection : null;
  const segment = (active: boolean) =>
    cn(
      'flex shrink-0 items-center gap-2 px-3.5 text-[13px] transition-colors',
      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#4359ef]',
      active
        ? 'bg-[var(--dashboard-fill-strong)] font-semibold text-[var(--dashboard-text)]'
        : 'font-medium text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-fill)] hover:text-[var(--dashboard-text)]'
    );

  return (
    <div className="relative max-w-full">
      <div className="max-w-full overflow-x-auto">
        <div
          role="group"
          aria-label="Date range"
          className="inline-flex h-10 items-stretch overflow-hidden rounded-[10px] border border-[var(--dashboard-line)] bg-[var(--dashboard-fill)]"
        >
          <button
            type="button"
            aria-pressed={custom !== null}
            aria-expanded={customOpen}
            aria-haspopup="dialog"
            onClick={() => setCustomOpen((open) => !open)}
            className={segment(custom !== null)}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {custom ? formatDays(custom.from, custom.to) : 'Custom'}
          </button>
          {PRESET_OPTIONS.map((option) => {
            const active = 'preset' in selection && selection.preset === option.value;

            return (
              <Fragment key={option.value}>
                <span className="w-px shrink-0 bg-[var(--dashboard-line)]" aria-hidden="true" />
                <button
                  type="button"
                  title={option.title}
                  aria-pressed={active}
                  onClick={() => {
                    setCustomOpen(false);
                    onChange({ preset: option.value });
                  }}
                  className={segment(active)}
                >
                  {option.label}
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      {customOpen ? (
        <CustomRangeDialog
          initial={custom}
          onApply={(next) => {
            setCustomOpen(false);
            onChange(next);
          }}
          onClose={() => setCustomOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CustomRangeDialog({
  initial,
  onApply,
  onClose,
}: {
  initial: { from: IsoDate; to: IsoDate } | null;
  onApply: (next: { from: IsoDate; to: IsoDate }) => void;
  onClose: () => void;
}) {
  const today = useToday();
  const [from, setFrom] = useState(initial?.from ?? '');
  const [to, setTo] = useState(initial?.to ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Escape or a click outside closes it, like any popover.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) onClose();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const found = customRangeProblem(from, to, new Date());

    if (found) {
      setProblem(found);

      return;
    }

    onApply({ from, to });
  };

  const field =
    'mt-1 h-9 w-full rounded-[8px] border border-[var(--dashboard-line)] bg-[var(--dashboard-field)] px-2 text-[13px] text-[var(--dashboard-text)] outline-none focus:border-[#4f7dff]';

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Custom range"
      className="absolute left-0 top-[calc(100%+8px)] z-30 w-[300px] rounded-[16px] border border-[var(--dashboard-line)] bg-[var(--dashboard-popover)] p-4 text-[var(--dashboard-text)] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.45)]"
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[12px] font-medium text-[var(--dashboard-text-muted)]">
            From
            <input
              type="date"
              value={from}
              max={to || today || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className={field}
              autoFocus
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--dashboard-text-muted)]">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={today ?? undefined}
              onChange={(event) => setTo(event.target.value)}
              className={field}
            />
          </label>
        </div>
        {problem ? (
          <p role="alert" className="mt-2 text-[12px] text-[var(--dashboard-danger)]">
            {problem}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full px-3 text-[13px] font-medium text-[var(--dashboard-text-muted)] transition-colors hover:text-[var(--dashboard-text)]"
          >
            Cancel
          </button>
          <button type="submit" className={cn(brandButton, 'h-9 px-4 text-[13px]')}>
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}
