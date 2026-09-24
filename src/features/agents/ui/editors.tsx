'use client';

import { Check, Plus, X } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { Tone } from '@/components/charts/verdict';
import { brandButton } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import {
  AGENT_MODEL_KEYS,
  AGENT_MODELS,
  PROFILE_LIMITS,
  SKILL_KEYS,
  SKILLS,
  VOICE_KEYS,
  VOICES,
  type AgentSection,
} from '../domain/agent-profile';
import { AgentMark, field, fieldLabel, focusRing, quietButton, RadioDot, SKILL_ICONS, Switch } from './parts';
import type { AgentProfileEditor } from './use-agent-profile';

/**
 * The four editors, one per Agent Suite card. Each edits the shared draft;
 * the bar at the foot of the section's page saves or discards it.
 */

/** A rule's id: random, made when the rule is added (never while rendering). */
function newRuleId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `rule-${crypto.randomUUID()}`
    : `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function IdentifierEditor({ editor }: { editor: AgentProfileEditor }) {
  const { profile, problems, update } = editor;
  const nameId = useId();
  const modelLabelId = useId();

  return (
    <>
      <div className="flex items-center gap-4 rounded-[14px] border border-[var(--dashboard-line)] bg-[var(--card-fill)] p-4">
        <AgentMark name={profile.name} size="large" />
        <div className="min-w-0">
          <p className="truncate text-[18px] font-semibold text-[var(--card-text)]">{profile.name.trim() || 'Unnamed agent'}</p>
          <p className="text-[13px] text-[var(--card-text-muted)]">
            {AGENT_MODELS[profile.model].name} · {VOICES[profile.voice].label} voice
          </p>
        </div>
      </div>

      <label htmlFor={nameId} className={cn(fieldLabel, 'mt-6')}>
        Name
      </label>
      <div className="mt-1.5 flex items-center gap-3">
        <input
          id={nameId}
          value={profile.name}
          onChange={(event) => {
            const name = event.target.value;

            update((current) => ({ ...current, name }));
          }}
          maxLength={PROFILE_LIMITS.name}
          autoComplete="off"
          aria-invalid={problems.name ? true : undefined}
          aria-describedby={problems.name ? `${nameId}-problem` : undefined}
          className={cn(field, 'h-10')}
        />
        <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-[var(--card-text-faint)]">
          {profile.name.length}/{PROFILE_LIMITS.name}
        </span>
      </div>
      {problems.name ? (
        <p id={`${nameId}-problem`} className="mt-1.5 text-[12px] text-[var(--dashboard-danger)]">
          {problems.name}
        </p>
      ) : null}

      <p id={modelLabelId} className={cn(fieldLabel, 'mt-6')}>
        Model
      </p>
      <div role="radiogroup" aria-labelledby={modelLabelId} className="mt-2 grid gap-2 md:grid-cols-3">
        {AGENT_MODEL_KEYS.map((key) => {
          const selected = profile.model === key;

          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update((current) => ({ ...current, model: key }))}
              className={cn(
                'rounded-[12px] border p-3.5 text-left transition-colors',
                focusRing,
                selected ? 'border-[#4f7dff] bg-[#4f7dff]/10' : 'border-[var(--dashboard-line)] hover:bg-[var(--card-fill)]'
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[14px] font-semibold text-[var(--card-text)]">{AGENT_MODELS[key].name}</span>
                <RadioDot selected={selected} />
              </span>
              <span className="mt-1 block text-[12px] leading-[18px] text-[var(--card-text-muted)]">{AGENT_MODELS[key].note}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function CultureEditor({ editor }: { editor: AgentProfileEditor }) {
  const { profile, problems, update } = editor;
  const cultureId = useId();
  const voiceLabelId = useId();

  return (
    <>
      <p id={voiceLabelId} className={fieldLabel}>
        Voice
      </p>
      <div
        role="radiogroup"
        aria-labelledby={voiceLabelId}
        className="mt-2 inline-flex flex-wrap gap-1 rounded-[12px] border border-[var(--dashboard-line)] p-1"
      >
        {VOICE_KEYS.map((key) => {
          const selected = profile.voice === key;

          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update((current) => ({ ...current, voice: key }))}
              className={cn(
                'h-8 rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors',
                focusRing,
                selected
                  ? 'bg-[#4f7dff] text-white'
                  : 'text-[var(--card-text-muted)] hover:bg-[var(--card-fill)] hover:text-[var(--card-text)]'
              )}
            >
              {VOICES[key].label}
            </button>
          );
        })}
      </div>
      {/* The same answer in the chosen voice: the choice heard, not described. */}
      <div className="mt-3 flex items-start gap-2.5">
        <AgentMark name={profile.name} size="small" />
        <p className="rounded-[14px] rounded-tl-[4px] border border-[var(--dashboard-line)] bg-[var(--card-fill)] px-3.5 py-2 text-[13px] leading-5 text-[var(--card-text-soft)]">
          {VOICES[profile.voice].example}
        </p>
      </div>

      <label htmlFor={cultureId} className={cn(fieldLabel, 'mt-6')}>
        Culture
      </label>
      <textarea
        id={cultureId}
        value={profile.culture}
        onChange={(event) => {
          const culture = event.target.value;

          update((current) => ({ ...current, culture }));
        }}
        maxLength={PROFILE_LIMITS.culture}
        rows={5}
        placeholder="Who you are, what you care about, how you treat a shopper."
        className={cn(field, 'mt-1.5 resize-none py-2.5 leading-[21px]')}
      />
      <div className="mt-1 flex items-start justify-between gap-3 text-[12px]">
        {problems.culture ? <p className="text-[var(--dashboard-danger)]">{problems.culture}</p> : <span />}
        <span className="tabular-nums text-[var(--card-text-faint)]">
          {profile.culture.length}/{PROFILE_LIMITS.culture}
        </span>
      </div>
    </>
  );
}

function RulesEditor({ editor }: { editor: AgentProfileEditor }) {
  const { profile, problems, update } = editor;
  const [text, setText] = useState('');
  const fieldId = useId();
  const full = profile.rules.length >= PROFILE_LIMITS.rules;

  const onAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = text.trim();

    if (!trimmed || full) return;

    const id = newRuleId();

    update((current) => ({ ...current, rules: [...current.rules, { id, text: trimmed }] }));
    setText('');
  };

  return (
    <>
      {profile.rules.length > 0 ? (
        <ol className="divide-y divide-[var(--dashboard-line)] overflow-hidden rounded-[12px] border border-[var(--dashboard-line)]">
          {profile.rules.map((rule, index) => (
            <li key={rule.id} className="flex items-center gap-2 py-1.5 pl-3 pr-1.5">
              <span className="w-5 shrink-0 text-center text-[12px] font-semibold tabular-nums text-[var(--card-text-faint)]">
                {index + 1}
              </span>
              <label htmlFor={`${fieldId}-${rule.id}`} className="sr-only">
                Rule {index + 1}
              </label>
              <input
                id={`${fieldId}-${rule.id}`}
                value={rule.text}
                onChange={(event) => {
                  const value = event.target.value;

                  update((current) => ({
                    ...current,
                    rules: current.rules.map((each) => (each.id === rule.id ? { ...each, text: value } : each)),
                  }));
                }}
                maxLength={PROFILE_LIMITS.rule}
                className="h-9 min-w-0 flex-1 rounded-[8px] bg-transparent px-2 text-[14px] text-[var(--card-text)] outline-none transition-colors focus:bg-[var(--card-fill)]"
              />
              <button
                type="button"
                onClick={() => update((current) => ({ ...current, rules: current.rules.filter((each) => each.id !== rule.id) }))}
                aria-label={`Remove rule ${index + 1}`}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--card-text-faint)] transition-colors',
                  'hover:bg-[var(--dashboard-fill-strong)] hover:text-[var(--card-text)]',
                  focusRing
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-[12px] border border-dashed border-[var(--dashboard-line)] px-4 py-5 text-center text-[13px] text-[var(--card-text-faint)]">
          No rules yet. Your agent goes by its culture alone.
        </p>
      )}

      <form onSubmit={onAdd} noValidate className="mt-3 flex gap-2">
        <label htmlFor={fieldId} className="sr-only">
          New rule
        </label>
        <input
          id={fieldId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={PROFILE_LIMITS.rule}
          disabled={full}
          autoComplete="off"
          placeholder={full ? `An agent keeps at most ${PROFILE_LIMITS.rules} rules.` : 'Add a rule, like: Always mention free returns.'}
          className={cn(field, 'h-10')}
        />
        <button type="submit" disabled={full || text.trim().length === 0} className={cn(quietButton, 'h-10', focusRing)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add rule
        </button>
      </form>
      <div className="mt-2 flex items-start justify-between gap-3 text-[12px]">
        {problems.rules ? <p className="text-[var(--dashboard-danger)]">{problems.rules}</p> : <span />}
        <span className="tabular-nums text-[var(--card-text-faint)]">
          {profile.rules.length}/{PROFILE_LIMITS.rules}
        </span>
      </div>
    </>
  );
}

function SkillsEditor({ editor }: { editor: AgentProfileEditor }) {
  const { profile, update } = editor;
  const labelPrefix = useId();

  return (
    <ul className="divide-y divide-[var(--dashboard-line)] overflow-hidden rounded-[12px] border border-[var(--dashboard-line)]">
      {SKILL_KEYS.map((key) => {
        const Icon = SKILL_ICONS[key];
        const on = profile.skills[key];
        const labelId = `${labelPrefix}-${key}`;

        return (
          <li key={key} className="flex items-center gap-3.5 px-4 py-3.5">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--dashboard-line)] transition-colors',
                on ? 'bg-[var(--card-fill)] text-[var(--card-text)]' : 'text-[var(--card-text-faint)]'
              )}
              aria-hidden="true"
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p id={labelId} className="text-[14px] font-semibold text-[var(--card-text)]">
                {SKILLS[key].name}
              </p>
              <p className="text-[12px] leading-[18px] text-[var(--card-text-muted)]">{SKILLS[key].description}</p>
            </div>
            <Switch
              checked={on}
              labelledBy={labelId}
              onChange={(next) => update((current) => ({ ...current, skills: { ...current.skills, [key]: next } }))}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function SectionEditor({ section, editor }: { section: AgentSection; editor: AgentProfileEditor }) {
  switch (section) {
    case 'identifier':
      return <IdentifierEditor editor={editor} />;
    case 'culture':
      return <CultureEditor editor={editor} />;
    case 'rules':
      return <RulesEditor editor={editor} />;
    case 'skills':
      return <SkillsEditor editor={editor} />;
  }
}

/** Rises from the foot of the page while there is something to save, and says so once it is saved. */
export function SaveBar({ editor, tone }: { editor: AgentProfileEditor; tone: Tone }) {
  const { dirty, problems, save, discard } = editor;
  const [justSaved, setJustSaved] = useState(false);
  const problem = problems.name ?? problems.rules ?? problems.culture;

  useEffect(() => {
    if (!justSaved) return;

    const timer = window.setTimeout(() => setJustSaved(false), 2200);

    return () => window.clearTimeout(timer);
  }, [justSaved]);

  return (
    <div className="pointer-events-none sticky bottom-5 z-20 mt-6 flex min-h-[52px] justify-center" aria-live="polite">
      {dirty || justSaved ? (
        <div
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-full border py-2 pl-5 pr-2 text-[13px]',
            'transition-[opacity,transform] duration-200 starting:translate-y-3 starting:opacity-0',
            tone === 'dark'
              ? 'border-white/10 bg-[#1c1c1f] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]'
              : 'border-ink/10 bg-white shadow-[0_18px_40px_-16px_rgba(25,25,25,0.35)]'
          )}
        >
          {dirty ? (
            <>
              <span className={cn('mr-2', problem ? 'text-[var(--dashboard-danger)]' : 'text-[var(--dashboard-text-muted)]')}>
                {problem ?? 'Unsaved changes'}
              </span>
              <button type="button" onClick={discard} className={cn(quietButton, focusRing)}>
                Discard
              </button>
              <button
                type="button"
                disabled={problem !== undefined}
                onClick={() => {
                  if (save()) setJustSaved(true);
                }}
                className={cn(brandButton, 'h-9 px-4 text-[13px]')}
              >
                Save changes
              </button>
            </>
          ) : (
            <span className="flex items-center gap-2 py-1.5 pr-3 font-medium text-[var(--dashboard-text)]">
              <Check className="h-4 w-4 text-[#2ecc71]" strokeWidth={3} aria-hidden="true" />
              Saved
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
