'use client';

import { useState, type FormEvent } from 'react';
import {
  AuthScreen,
  continueClassName,
  FloatingField,
  quietLinkClassName,
  Required,
} from '@/components/auth/auth-column';
import { useAuth } from '@/contexts/auth-context';
import { useOrganizations } from '@/contexts/organization-context';
import * as organizationsClient from '@/lib/clients/organizations.client';
import { logger } from '@/lib/logger';
import type { OrganizationDto } from '@/types/api';

/**
 * The one step between signing in and the dashboard for an organization
 * nobody has set up yet: confirm its name. It is the login column
 * (components/auth/auth-column.tsx) with a different single field, because
 * it is the same moment in the person's first visit, not a page of the app.
 *
 * It asks for nothing else. It used to ask "What are you building?" with a
 * single answer (E-commerce) left over from v1's three product lines; a
 * question with one answer decides nothing.
 *
 * The app shell (rail, switcher, profile menu) is hidden while this shows,
 * so the quiet link under the button is the only way out for someone who
 * signed in with the wrong account.
 */
export function OrganizationSetupScreen({ organization }: { organization: OrganizationDto }) {
  const { signOut } = useAuth();
  const { refreshOrganizations } = useOrganizations();
  const [name, setName] = useState(organization.name);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Organization name is required.');

      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await organizationsClient.updateOrganization(organization.id, {
        name: trimmedName,
        completeOnboarding: true,
      });
      // The refreshed organization carries onboardingCompletedAt, which is
      // what swaps this screen for the dashboard in AppLayout.
      await refreshOrganizations();
    } catch (updateError) {
      logger.error('Failed to set up organization', updateError);
      setError(
        updateError instanceof organizationsClient.ApiRequestError
          ? updateError.message
          : 'Failed to set up organization.'
      );
    }

    setIsSaving(false);
  };

  return (
    <AuthScreen heading="Welcome" subtitle="Set up your organization to continue.">
      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <FloatingField
          id="organization-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          autoComplete="organization"
          autoFocus
          disabled={isSaving}
          label={
            <>
              Organization name
              <Required />
            </>
          }
          error={error ?? undefined}
        />
        <button type="submit" disabled={isSaving} aria-busy={isSaving} className={continueClassName}>
          {isSaving ? 'Saving…' : 'Continue'}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <button type="button" onClick={() => void signOut()} className={quietLinkClassName}>
          Log out
        </button>
      </div>
    </AuthScreen>
  );
}
