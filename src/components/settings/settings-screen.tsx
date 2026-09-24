'use client';

import { Check, Loader2, LogOut, Plus } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { AvatarMark } from '@/components/layout/sidebar';
import { useAuth } from '@/contexts/auth-context';
import { useOrganizations } from '@/contexts/organization-context';
import {
  setDashboardTheme,
  useDashboardTheme,
  type DashboardTheme,
} from '@/hooks/use-dashboard-theme';
import { cn } from '@/lib/utils';

/**
 * Settings: how the dashboard looks, which organization you are in, and
 * your account. The organization switcher and Log out moved here from the
 * rail (owner's direction, 23 Sep 2026), so the rail is navigation only.
 */

const THEMES: ReadonlyArray<{
  value: DashboardTheme;
  label: string;
  description: string;
  rail: string;
  page: string;
  line: string;
  card: string;
}> = [
  {
    value: 'dark',
    label: 'Dark',
    description: 'A dark rail over a dark page, dark cards.',
    rail: '#1a1a1a',
    page: '#141414',
    line: 'rgba(255,255,255,0.14)',
    card: 'linear-gradient(165deg,#232327,#111113)',
  },
  {
    value: 'light',
    label: 'Grey',
    description: 'A grey rail over a light page, light cards.',
    rail: '#e8e8e8',
    page: '#f7f7f7',
    line: 'rgba(25,25,25,0.14)',
    card: 'linear-gradient(180deg,#ffffff,#fafaf9)',
  },
];

const sectionTitle = 'text-[15px] font-semibold';
const sectionNote = 'mt-1 text-[13px] text-[var(--dashboard-text-muted)]';
const listFrame = 'mt-4 overflow-hidden rounded-[16px] border border-[var(--dashboard-line)]';
const quietButton =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--dashboard-line)] px-4 text-[13px] font-semibold ' +
  'text-[var(--dashboard-text)] transition-colors hover:bg-[var(--dashboard-fill-strong)] disabled:opacity-60';

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 border-t border-[var(--dashboard-line)] pt-8 first:border-t-0 first:pt-0"
    >
      <h2 className={sectionTitle}>{title}</h2>
      <p className={sectionNote}>{note}</p>
      {children}
    </section>
  );
}

/** A small picture of the shell in each theme: the floating rail, the page, two cards. */
function ThemePicture({ theme }: { theme: (typeof THEMES)[number] }) {
  return (
    <div
      className="flex h-[108px] gap-2 overflow-hidden rounded-[10px] p-2"
      style={{ backgroundColor: theme.page }}
      aria-hidden="true"
    >
      <div
        className="flex w-[30%] flex-col gap-1.5 rounded-[7px] p-2 shadow-[0_0_0_1px_rgba(127,127,127,0.18)]"
        style={{ backgroundColor: theme.rail }}
      >
        <span className="h-2 w-10 rounded-full" style={{ backgroundColor: theme.line }} />
        <span className="mt-1 h-2.5 w-full rounded-[4px]" style={{ backgroundColor: theme.line }} />
        <span className="h-2 w-3/4 rounded-full" style={{ backgroundColor: theme.line }} />
        <span className="h-2 w-2/3 rounded-full" style={{ backgroundColor: theme.line }} />
      </div>
      <div className="flex flex-1 flex-col gap-2 py-1">
        <span className="h-2.5 w-20 rounded-full" style={{ backgroundColor: theme.line }} />
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <span
            className="rounded-[6px] shadow-[0_0_0_1px_rgba(127,127,127,0.18)]"
            style={{ background: theme.card }}
          />
          <span
            className="rounded-[6px] shadow-[0_0_0_1px_rgba(127,127,127,0.18)]"
            style={{ background: theme.card }}
          />
        </div>
      </div>
    </div>
  );
}

function AppearanceSection() {
  const current = useDashboardTheme();

  return (
    <Section
      id="appearance"
      title="Appearance"
      note="The rail, the page and the cards. Kept in this browser."
    >
      <div role="radiogroup" aria-label="Theme" className="mt-4 grid gap-3 sm:grid-cols-2">
        {THEMES.map(theme => {
          const selected = theme.value === current;

          return (
            <button
              key={theme.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setDashboardTheme(theme.value)}
              className={cn(
                'rounded-[16px] border p-2.5 text-left transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]',
                selected
                  ? 'border-[#4f7dff] bg-[var(--dashboard-fill)]'
                  : 'border-[var(--dashboard-line)] hover:bg-[var(--dashboard-fill)]'
              )}
            >
              <ThemePicture theme={theme} />
              <div className="mt-3 flex items-start justify-between gap-3 px-1 pb-1">
                <div>
                  <p className="text-[14px] font-semibold">{theme.label}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--dashboard-text-muted)]">
                    {theme.description}
                  </p>
                </div>
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    selected
                      ? 'border-[#4f7dff] bg-[#4f7dff] text-white'
                      : 'border-[var(--dashboard-line)]'
                  )}
                  aria-hidden="true"
                >
                  {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * The organizations you belong to: switch into another (the provider
 * re-issues the session and reloads on it), or create one (the new one
 * becomes the one you are in). A refused switch says why on the row that
 * was clicked, in the same alert line a failed create uses; it used to be
 * logged and nothing else, so the button simply stopped spinning.
 */
function OrganizationSection() {
  const { activeOrganization, organizations, loading, selectOrganization, createOrganization } =
    useOrganizations();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<{
    organizationId: string;
    message: string;
  } | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const onSwitch = async (organizationId: string) => {
    if (switchingId || organizationId === activeOrganization?.id) return;

    setSwitchingId(organizationId);
    setSwitchError(null);

    try {
      const message = await selectOrganization(organizationId);

      if (message) setSwitchError({ organizationId, message });
    } finally {
      setSwitchingId(null);
    }
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = name.trim();

    if (!trimmed) {
      setCreateError('Give the organization a name.');

      return;
    }

    setCreating(true);
    setCreateError(null);

    const error = await createOrganization(trimmed);

    setCreating(false);

    if (error) {
      setCreateError(error);

      return;
    }

    setName('');
  };

  return (
    <Section
      id="organization"
      title="Organization"
      note="The organization you are working in, and the others you belong to."
    >
      {loading || organizations.length > 0 ? (
        <ul className={cn(listFrame, 'divide-y divide-[var(--dashboard-line)]')}>
          {loading && organizations.length === 0 ? (
            <li className="flex items-center gap-2 px-4 py-3.5 text-[13px] text-[var(--dashboard-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading organizations…
            </li>
          ) : null}
          {organizations.map(organization => {
            const current = organization.id === activeOrganization?.id;
            const initial = organization.name.trim().charAt(0).toUpperCase() || 'O';

            return (
              <li key={organization.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-bold text-white [background:var(--brand-face)]"
                  aria-hidden="true"
                >
                  {initial}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{organization.name}</p>
                  <p className="text-[12px] capitalize text-[var(--dashboard-text-muted)]">
                    {organization.role}
                  </p>
                  {switchError?.organizationId === organization.id ? (
                    <p role="alert" className="mt-1.5 text-[12px] text-[var(--dashboard-danger)]">
                      {switchError.message}
                    </p>
                  ) : null}
                </div>
                {current ? (
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#4f7dff]/15 px-2.5 text-[12px] font-semibold text-[#4f7dff]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                    Current
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onSwitch(organization.id)}
                    disabled={switchingId !== null}
                    className={quietButton}
                  >
                    {switchingId === organization.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {switchingId === organization.id ? 'Switching…' : 'Switch'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      <form onSubmit={onCreate} noValidate className="mt-4 flex flex-wrap items-start gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="new-organization-name" className="sr-only">
            New organization name
          </label>
          <input
            id="new-organization-name"
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={100}
            placeholder="New organization name"
            disabled={creating}
            className="h-9 w-full rounded-[10px] border border-[var(--dashboard-line)] bg-[var(--dashboard-field)] px-3 text-[13px] text-[var(--dashboard-text)] outline-none placeholder:text-[var(--dashboard-text-muted)] focus:border-[#4f7dff]"
          />
          {createError ? (
            <p role="alert" className="mt-1.5 text-[12px] text-[var(--dashboard-danger)]">
              {createError}
            </p>
          ) : null}
        </div>
        <button type="submit" disabled={creating} className={quietButton}>
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          {creating ? 'Creating…' : 'Create organization'}
        </button>
      </form>
    </Section>
  );
}

/** Who you are signed in as, and the way out. */
function AccountSection() {
  const { user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const displayName = user?.displayName || 'User';

  // signOut navigates away and never settles, so the spinner stays until
  // the page goes. It used to sit in a try whose catch navigated again,
  // for a rejection that cannot happen.
  const onLogOut = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    await signOut();
  };

  return (
    <Section id="account" title="Account" note="The account you are signed in with.">
      <div className={cn(listFrame, 'flex flex-wrap items-center gap-3 px-4 py-3.5')}>
        <AvatarMark
          key={user?.avatarUrl ?? 'initial'}
          avatarUrl={user?.avatarUrl}
          displayName={displayName}
          avatarInitial={displayName.trim().charAt(0).toUpperCase()}
          className="h-10 w-10"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{displayName}</p>
          <p className="truncate text-[12px] text-[var(--dashboard-text-muted)]">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void onLogOut()}
          disabled={loggingOut}
          className={cn(quietButton, 'text-[var(--dashboard-danger)]')}
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </Section>
  );
}

export function SettingsScreen() {
  return (
    <section className="min-h-full px-6 pb-14 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Settings</h1>
      <div className="mt-8 max-w-3xl space-y-8">
        <AppearanceSection />
        <OrganizationSection />
        <AccountSection />
      </div>
    </section>
  );
}
