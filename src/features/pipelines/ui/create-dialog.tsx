'use client';

import { useId, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/modal';
import { brandButton } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import type { CreateResult } from '../application/pipeline-actions';
import {
  draftProblems,
  emptyDraft,
  KIND_TRIGGERS,
  PIPELINE_LIMITS,
  SYNC_DATA,
  SYNC_DATA_LABELS,
  TRIGGER_LABELS,
  type DraftProblems,
  type PipelineKind,
  type Trigger,
} from '../domain/pipeline';

const field =
  'mt-1.5 h-10 w-full rounded-[10px] border border-[var(--dashboard-line)] bg-[var(--dashboard-field)] px-3 text-[14px] text-[var(--dashboard-text)] ' +
  'outline-none transition-colors placeholder:text-[var(--dashboard-text-muted)] focus:border-[#4f7dff]';
const label = 'block text-[13px] font-medium text-[var(--dashboard-text)]';
const problemText = 'mt-1.5 text-[12px] text-[var(--dashboard-danger)]';

const COPY: Record<PipelineKind, { title: string; description: string; submit: string }> = {
  sync: {
    title: 'New sync',
    description: "Keep Sculptors in step with your store's own data.",
    submit: 'Create sync',
  },
  job: {
    title: 'New job',
    description: 'Run a task on a schedule, or whenever you start it.',
    submit: 'Create job',
  },
};

/** The form behind Create > Sync and Create > New Job. */
export function CreateDialog({
  kind,
  onClose,
  onCreate,
}: {
  kind: PipelineKind | null;
  onClose: () => void;
  onCreate: (draft: ReturnType<typeof emptyDraft>) => CreateResult;
}) {
  return (
    <Modal open={kind !== null} onClose={onClose} title={kind ? COPY[kind].title : ''} description={kind ? COPY[kind].description : undefined}>
      {/* Keyed by kind, so each opening starts from an empty draft. */}
      {kind ? <CreateForm key={kind} kind={kind} onClose={onClose} onCreate={onCreate} /> : null}
    </Modal>
  );
}

function CreateForm({
  kind,
  onClose,
  onCreate,
}: {
  kind: PipelineKind;
  onClose: () => void;
  onCreate: (draft: ReturnType<typeof emptyDraft>) => CreateResult;
}) {
  const [draft, setDraft] = useState(() => emptyDraft(kind));
  const [problems, setProblems] = useState<DraftProblems>({});
  const nameId = useId();
  const triggerId = useId();
  const tagsId = useId();
  const dataLabelId = useId();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const found = draftProblems(draft);

    if (Object.keys(found).length > 0) {
      setProblems(found);

      return;
    }

    const result = onCreate(draft);

    if (result.ok) onClose();
    else setProblems(result.problems);
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={nameId} className={label}>
        Name
      </label>
      <input
        id={nameId}
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        maxLength={PIPELINE_LIMITS.name}
        placeholder={kind === 'sync' ? 'Shopify catalog' : 'Nightly discovery pages'}
        autoComplete="off"
        autoFocus
        className={field}
      />
      {problems.name ? <p className={problemText}>{problems.name}</p> : null}

      {kind === 'sync' ? (
        <fieldset className="mt-5">
          <legend id={dataLabelId} className={label}>
            Keeps in step
          </legend>
          <div className="mt-2 flex flex-wrap gap-2" aria-labelledby={dataLabelId}>
            {SYNC_DATA.map((data) => {
              const checked = draft.data.includes(data);

              return (
                <label
                  key={data}
                  className={cn(
                    'inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                    checked
                      ? 'border-[#4f7dff] bg-[#4f7dff]/10 text-[var(--dashboard-text)]'
                      : 'border-[var(--dashboard-line)] text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        data: checked ? draft.data.filter((each) => each !== data) : SYNC_DATA.filter((each) => each === data || draft.data.includes(each)),
                      })
                    }
                    className="h-3.5 w-3.5 accent-[#4f7dff]"
                  />
                  {SYNC_DATA_LABELS[data]}
                </label>
              );
            })}
          </div>
          {problems.data ? <p className={problemText}>{problems.data}</p> : null}
        </fieldset>
      ) : null}

      <label htmlFor={triggerId} className={cn(label, 'mt-5')}>
        Trigger
      </label>
      <select
        id={triggerId}
        value={draft.trigger}
        onChange={(event) => setDraft({ ...draft, trigger: event.target.value as Trigger })}
        className={cn(field, 'appearance-auto pr-2')}
      >
        {KIND_TRIGGERS[kind].map((trigger) => (
          <option key={trigger} value={trigger}>
            {TRIGGER_LABELS[trigger]}
          </option>
        ))}
      </select>
      {problems.trigger ? <p className={problemText}>{problems.trigger}</p> : null}

      <label htmlFor={tagsId} className={cn(label, 'mt-5')}>
        Tags <span className="font-normal text-[var(--dashboard-text-muted)]">(optional)</span>
      </label>
      <input
        id={tagsId}
        value={draft.tags}
        onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
        placeholder="catalog, nightly"
        autoComplete="off"
        className={field}
      />
      <p className={problems.tags ? problemText : 'mt-1.5 text-[12px] text-[var(--dashboard-text-muted)]'}>
        {problems.tags ?? `Comma-separated, up to ${PIPELINE_LIMITS.tags}.`}
      </p>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center rounded-full border border-[var(--dashboard-line)] px-4 text-[14px] font-medium transition-colors hover:bg-[var(--dashboard-fill-strong)]"
        >
          Cancel
        </button>
        <button type="submit" className={brandButton}>
          {COPY[kind].submit}
        </button>
      </div>
    </form>
  );
}
