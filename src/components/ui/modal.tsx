'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A modal on the browser's own <dialog>: it traps focus, closes on Escape
 * and dims the page behind it. A press on the dimmed page closes it too.
 * It stays in the themed shell's tree, so it takes the theme's colours.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;

    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100%-32px)] max-w-[480px] rounded-[18px] border border-[var(--dashboard-line)] bg-[var(--dashboard-popover)] p-0',
        'text-[var(--dashboard-text)] shadow-[0_30px_80px_-24px_rgba(0,0,0,0.6)] backdrop:bg-black/45',
        className
      )}
    >
      {open ? (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="modal-title" className="text-[18px] font-semibold tracking-[-0.01em]">
                {title}
              </h2>
              {description ? <p className="mt-1 text-[13px] text-[var(--dashboard-text-muted)]">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-fill-strong)] hover:text-[var(--dashboard-text)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
