'use client';

import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  CalendarClock,
  ChevronDown,
  Columns3,
  Ellipsis,
  RefreshCw,
  Search,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Dropdown } from '@/components/ui/dropdown';
import { brandFace } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import {
  filterPipelines,
  KIND_LABELS,
  NO_FILTERS,
  sortPipelines,
  SYNC_DATA_LABELS,
  TRIGGER_LABELS,
  type KindFilter,
  type Pipeline,
  type PipelineFilters,
  type PipelineKind,
  type ScopeFilter,
  type SortDirection,
} from '../domain/pipeline';
import { CreateDialog } from './create-dialog';
import { usePipelines } from './use-pipelines';

/**
 * Pipelines: every sync and job of the organization in one list, after the
 * jobs and pipelines lists of data platforms the owner pointed to (23 Sep
 * 2026) -- a filter by name or id, the kind, whose they are, tags and whose
 * rights they run with, and Create for a sync or a new job. What each one
 * does is for a later conversation with the owner; the list is its frame.
 */

const KIND_ICONS: Record<PipelineKind, LucideIcon> = { sync: RefreshCw, job: CalendarClock };

const COLUMNS = ['type', 'tags', 'runAs', 'trigger', 'runs'] as const;

type Column = (typeof COLUMNS)[number];

const COLUMN_LABELS: Record<Column, string> = {
  type: 'Type',
  tags: 'Tags',
  runAs: 'Run as',
  trigger: 'Trigger',
  runs: 'Recent runs',
};

const KIND_OPTIONS: ReadonlyArray<{ value: KindFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'job', label: 'Jobs' },
  { value: 'sync', label: 'Syncs' },
];

const SCOPE_OPTIONS: ReadonlyArray<{ value: ScopeFilter; label: string }> = [
  { value: 'owned', label: 'Owned by me' },
  { value: 'accessible', label: 'Accessible by me' },
  { value: 'favorites', label: 'Favorites' },
];

const control =
  'inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--dashboard-line)] px-3.5 text-[14px] font-medium ' +
  'text-[var(--dashboard-text)] transition-colors hover:bg-[var(--dashboard-fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]';

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-10 overflow-hidden rounded-[10px] border border-[var(--dashboard-line)]">
      {options.map((option, index) => {
        const active = option.value === value;

        return (
          <Fragment key={option.value}>
            {index > 0 ? <span className="w-px shrink-0 bg-[var(--dashboard-line)]" aria-hidden="true" /> : null}
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'px-3 text-[14px] font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#4359ef]',
                active
                  ? 'bg-[#4f7dff]/12 text-[var(--dashboard-text)] shadow-[inset_0_0_0_1px_rgba(79,125,255,0.55)]'
                  : 'text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-fill)] hover:text-[var(--dashboard-text)]'
              )}
            >
              {option.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

/** A checklist filter (Tags, Run as): any of the ticked values. */
function ChecklistFilter({
  label,
  options,
  selected,
  empty,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  empty: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <Dropdown
      buttonClassName={cn(control, selected.length > 0 && 'border-[#4f7dff]/60')}
      button={
        <>
          {label}
          {selected.length > 0 ? (
            <span className="rounded-full bg-[var(--dashboard-fill-strong)] px-1.5 text-[12px] tabular-nums">{selected.length}</span>
          ) : null}
          <ChevronDown className="h-4 w-4 text-[var(--dashboard-text-muted)]" aria-hidden="true" />
        </>
      }
    >
      {() => (
        <div role="group" aria-label={label}>
          {options.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-[var(--dashboard-text-muted)]">{empty}</p>
          ) : (
            options.map((option) => {
              const checked = selected.includes(option);

              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] hover:bg-[var(--dashboard-fill)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(checked ? selected.filter((each) => each !== option) : [...selected, option])}
                    className="h-3.5 w-3.5 accent-[#4f7dff]"
                  />
                  <span className="truncate">{option}</span>
                </label>
              );
            })
          )}
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-[8px] border-t border-[var(--dashboard-line)] px-2.5 pb-1.5 pt-2.5 text-left text-[13px] text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]"
            >
              Clear
            </button>
          ) : null}
        </div>
      )}
    </Dropdown>
  );
}

function CreateMenu({ onChoose }: { onChoose: (kind: PipelineKind) => void }) {
  const items: ReadonlyArray<{ kind: PipelineKind; title: string; note: string }> = [
    { kind: 'sync', title: 'Sync', note: 'Keep Sculptors in step with your products, customers or orders.' },
    { kind: 'job', title: 'New Job', note: 'Run a task on a schedule, or whenever you start it.' },
  ];

  return (
    <Dropdown
      align="end"
      panelClassName="w-[300px]"
      buttonClassName={cn(
        'inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[14px] font-medium transition-[filter] hover:brightness-110',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]',
        brandFace
      )}
      button={
        <>
          Create
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </>
      }
    >
      {(close) => (
        <div role="menu" aria-label="Create">
          {items.map((item) => {
            const Icon = KIND_ICONS[item.kind];

            return (
              <button
                key={item.kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onChoose(item.kind);
                }}
                className="flex w-full items-start gap-3 rounded-[9px] px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--dashboard-fill)]"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[var(--dashboard-line)] text-[var(--dashboard-text)]">
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-[17px] text-[var(--dashboard-text-muted)]">{item.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Dropdown>
  );
}

function ColumnsMenu({ visible, onToggle }: { visible: ReadonlySet<Column>; onToggle: (column: Column) => void }) {
  return (
    <Dropdown
      align="end"
      label="Columns"
      buttonClassName="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-fill)] hover:text-[var(--dashboard-text)]"
      button={<Columns3 className="h-[18px] w-[18px]" aria-hidden="true" />}
    >
      {() => (
        <div role="group" aria-label="Columns">
          {COLUMNS.map((column) => (
            <label
              key={column}
              className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] font-normal hover:bg-[var(--dashboard-fill)]"
            >
              <input
                type="checkbox"
                checked={visible.has(column)}
                onChange={() => onToggle(column)}
                className="h-3.5 w-3.5 accent-[#4f7dff]"
              />
              {COLUMN_LABELS[column]}
            </label>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

/** Two dots and two lines: an empty list, as the reference draws it. */
function EmptyList({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="space-y-2.5 text-[var(--dashboard-text-muted)] opacity-60" aria-hidden="true">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-2.5">
            <span className="h-5 w-5 rounded-full bg-current" />
            <span className="h-1.5 w-8 rounded-full bg-current" />
          </div>
        ))}
      </div>
      <div className="mt-5 text-[14px] text-[var(--dashboard-text-muted)]">{children}</div>
    </div>
  );
}

function Row({
  item,
  columns,
  onFavorite,
  onDelete,
}: {
  item: Pipeline;
  columns: ReadonlySet<Column>;
  onFavorite: () => void;
  onDelete: () => void;
}) {
  const Icon = KIND_ICONS[item.kind];

  return (
    <tr className="border-b border-[var(--dashboard-line)] transition-colors hover:bg-[var(--dashboard-fill)]">
      <td className="py-3 pl-2 pr-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFavorite}
            aria-pressed={item.favorite}
            aria-label={item.favorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-fill-strong)] hover:text-[var(--dashboard-text)]"
          >
            <Star className={cn('h-4 w-4', item.favorite && 'fill-current text-[var(--dashboard-text)]')} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--dashboard-text)]">{item.name}</p>
            <p className="font-mono text-[11px] text-[var(--dashboard-text-muted)]">{item.id}</p>
          </div>
        </div>
      </td>
      {columns.has('type') ? (
        <td className="py-3 pr-4">
          <span className="inline-flex items-center gap-1.5 text-[var(--dashboard-text)]">
            <Icon className="h-4 w-4 text-[var(--dashboard-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
            {KIND_LABELS[item.kind]}
          </span>
          {item.kind === 'sync' ? (
            <p className="text-[12px] text-[var(--dashboard-text-muted)]">{item.data.map((data) => SYNC_DATA_LABELS[data]).join(', ')}</p>
          ) : null}
        </td>
      ) : null}
      {columns.has('tags') ? (
        <td className="py-3 pr-4">
          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-[6px] border border-[var(--dashboard-line)] px-1.5 py-0.5 text-[12px] text-[var(--dashboard-text-muted)]">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[var(--dashboard-text-muted)]">—</span>
          )}
        </td>
      ) : null}
      {columns.has('runAs') ? <td className="truncate py-3 pr-4 text-[var(--dashboard-text)]">{item.runAs}</td> : null}
      {columns.has('trigger') ? <td className="py-3 pr-4 text-[var(--dashboard-text)]">{TRIGGER_LABELS[item.trigger]}</td> : null}
      {columns.has('runs') ? <td className="py-3 pr-4 text-[13px] text-[var(--dashboard-text-muted)]">No runs yet</td> : null}
      <td className="py-3 pr-2 text-right">
        <Dropdown
          align="end"
          label={`Actions for ${item.name}`}
          panelClassName="min-w-[160px]"
          buttonClassName="flex h-8 w-8 items-center justify-center rounded-full text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-fill-strong)] hover:text-[var(--dashboard-text)]"
          button={<Ellipsis className="h-4 w-4" aria-hidden="true" />}
        >
          {(close) => (
            <div role="menu" aria-label={`Actions for ${item.name}`}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-[var(--dashboard-danger)] hover:bg-[var(--dashboard-fill)]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </Dropdown>
      </td>
    </tr>
  );
}

export function PipelinesScreen() {
  const { items, memberId, create, toggleFavorite, remove } = usePipelines();
  const [filters, setFilters] = useState<PipelineFilters>(NO_FILTERS);
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [columns, setColumns] = useState<ReadonlySet<Column>>(() => new Set(COLUMNS));
  const [creating, setCreating] = useState<PipelineKind | null>(null);

  const tags = useMemo(() => [...new Set(items.flatMap((item) => item.tags))].sort(), [items]);
  const runAs = useMemo(() => [...new Set(items.map((item) => item.runAs))].sort(), [items]);
  const shown = useMemo(
    () => sortPipelines(filterPipelines(items, filters, memberId), direction),
    [items, filters, memberId, direction]
  );
  const filtered = filters.query !== '' || filters.kind !== 'all' || filters.scope !== 'accessible' || filters.tags.length > 0 || filters.runAs.length > 0;
  const SortIcon = direction === 'asc' ? ArrowUpNarrowWide : ArrowDownNarrowWide;

  const onDelete = (item: Pipeline) => {
    if (window.confirm(`Delete ${item.name}? This cannot be undone.`)) remove(item.id);
  };

  return (
    <section className="min-h-full px-6 pb-14 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em]">Pipelines</h1>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Filter by name or ID</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dashboard-text-muted)]" aria-hidden="true" />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            placeholder="Filter by name or ID…"
            className="h-10 w-[220px] rounded-[10px] border border-[var(--dashboard-line)] bg-transparent pl-9 pr-3 text-[14px] text-[var(--dashboard-text)] outline-none transition-colors placeholder:text-[var(--dashboard-text-muted)] focus:border-[#4f7dff]"
          />
        </label>
        <Segmented label="Kind" options={KIND_OPTIONS} value={filters.kind} onChange={(kind) => setFilters({ ...filters, kind })} />
        <Segmented label="Whose" options={SCOPE_OPTIONS} value={filters.scope} onChange={(scope) => setFilters({ ...filters, scope })} />
        <ChecklistFilter
          label="Tags"
          options={tags}
          selected={filters.tags}
          empty="No tags yet."
          onChange={(next) => setFilters({ ...filters, tags: next })}
        />
        <ChecklistFilter
          label="Run as"
          options={runAs}
          selected={filters.runAs}
          empty="Nothing runs yet."
          onChange={(next) => setFilters({ ...filters, runAs: next })}
        />
        <div className="ml-auto">
          <CreateMenu onChoose={setCreating} />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-[var(--dashboard-line)] text-[13px] font-semibold text-[var(--dashboard-text)]">
              <th scope="col" className="py-3 pl-12 pr-4">
                <button
                  type="button"
                  onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}
                  aria-label={`Name, sorted ${direction === 'asc' ? 'A to Z' : 'Z to A'}`}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--dashboard-text-muted)]"
                >
                  Name
                  <SortIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </th>
              {COLUMNS.filter((column) => columns.has(column)).map((column) => (
                <th key={column} scope="col" className="py-3 pr-4">
                  {COLUMN_LABELS[column]}
                </th>
              ))}
              <th scope="col" className="w-12 py-2 pr-2 text-right">
                <ColumnsMenu
                  visible={columns}
                  onToggle={(column) =>
                    setColumns((current) => {
                      const next = new Set(current);

                      if (next.has(column)) next.delete(column);
                      else next.add(column);

                      return next;
                    })
                  }
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <Row
                key={item.id}
                item={item}
                columns={columns}
                onFavorite={() => toggleFavorite(item.id)}
                onDelete={() => onDelete(item)}
              />
            ))}
          </tbody>
        </table>

        {shown.length === 0 ? (
          <EmptyList>
            {filtered && items.length > 0 ? (
              <>
                No jobs or syncs match these filters.{' '}
                <button type="button" onClick={() => setFilters(NO_FILTERS)} className="font-medium text-[var(--dashboard-text)] underline underline-offset-2">
                  Clear filters
                </button>
              </>
            ) : (
              'No jobs or syncs found.'
            )}
          </EmptyList>
        ) : null}
      </div>

      <CreateDialog kind={creating} onClose={() => setCreating(null)} onCreate={create} />
    </section>
  );
}
