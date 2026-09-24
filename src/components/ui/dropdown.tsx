'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A button that opens a panel under it: a menu, a checklist, a picker.
 * Escape or a press outside closes it, and focus goes back to the button.
 * The panel's content is a render prop, so an item can close it.
 */
export function Dropdown({
  button,
  buttonClassName,
  label,
  align = 'start',
  panelClassName,
  children,
}: {
  /** What the button shows. */
  button: ReactNode;
  buttonClassName: string;
  /** The button's accessible name when its content is not enough (an icon). */
  label?: string;
  align?: 'start' | 'end';
  panelClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // The button is found by id, not by ref: `close` reaches the render prop,
  // and a function read during render may not touch a ref.
  const buttonId = useId();

  const close = useCallback(() => {
    setOpen(false);
    document.getElementById(buttonId)?.focus();
  }, [buttonId]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  return (
    <div ref={root} className="relative inline-flex">
      <button
        id={buttonId}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className={buttonClassName}
      >
        {button}
      </button>
      {open ? (
        <div
          className={cn(
            'absolute top-[calc(100%+6px)] z-30 min-w-[200px] rounded-[12px] border border-[var(--dashboard-line)] bg-[var(--dashboard-popover)] p-1.5',
            'text-[var(--dashboard-text)] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.45)]',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
