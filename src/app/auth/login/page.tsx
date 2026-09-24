'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';
import {
  AuthScreen,
  continueClassName,
  FloatingField,
  INK,
  MUTED,
  quietLinkClassName,
  Required,
} from '@/components/auth/auth-column';
import { AppLoader } from '@/components/ui/app-loader';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/config/constants';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { loginSchema, type LoginInput } from '@/lib/validations';

/**
 * The login screen after Harvey's: the shared auth column
 * (components/auth/auth-column.tsx) with "Welcome" as its heading.
 *
 * Harvey also asks for the email first and the password on a second step;
 * this does the same. Every mode the old page had (SSO, reset, code
 * verification) survives, each as the same column with a different single
 * field, because the API routes behind them did not change.
 */

type AuthMode = 'login' | 'sso' | 'forgot' | 'verify';
type LoginStep = 'email' | 'password';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: sessionLoading, refreshUser } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<LoginStep>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [pendingAuthenticationToken, setPendingAuthenticationToken] = useState('');
  const [isSSOSubmitting, setIsSSOSubmitting] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setFocus,
    formState: { isSubmitting, errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user) {
      router.replace(DEFAULT_AUTHENTICATED_ROUTE);
    }
  }, [user, router]);

  useEffect(() => {
    const requestedMode = searchParams.get('mode');

    if (requestedMode === 'sso' || requestedMode === 'forgot') {
      setMode(requestedMode);
    }
  }, [searchParams]);

  // The password field only exists once the email step is done; focusing it
  // has to wait for that render.
  useEffect(() => {
    if (mode === 'login' && step === 'password') {
      setFocus('password');
    }
  }, [mode, step, setFocus]);

  const handleEmailContinue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (await trigger('email')) {
      setStep('password');
    }
  };

  const onSubmit = async (data: LoginInput) => {
    try {
      const response = await fetch('/api/auth/workos/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: data.email.trim(),
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (result.requiresEmailVerification && result.pendingAuthenticationToken) {
          setVerificationEmail(data.email.trim());
          setPendingAuthenticationToken(result.pendingAuthenticationToken);
          setVerificationCode('');
          setMode('verify');
          toast.success('Verification code sent to your email.');

          return;
        }

        toast.error(result.error || 'Login failed');

        return;
      }

      await refreshUser();
      router.replace(DEFAULT_AUTHENTICATED_ROUTE);
    } catch (err) {
      const error = err as { message?: string };

      toast.error(error.message || 'Login failed. Please try again');
    }
  };

  const handleEmailVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingAuthenticationToken) {
      toast.error('Please sign in again to request a new verification code.');
      setMode('login');

      return;
    }

    try {
      setIsVerifying(true);
      const response = await fetch('/api/auth/workos/email-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          code: verificationCode.trim(),
          pendingAuthenticationToken,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error || 'Verification failed');

        return;
      }

      await refreshUser();
      router.replace(DEFAULT_AUTHENTICATED_ROUTE);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSSOSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanEmail = ssoEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setSsoError('Enter your company email address.');

      return;
    }

    setSsoError(null);

    const params = new URLSearchParams({
      login_hint: cleanEmail,
    });

    setIsSSOSubmitting(true);
    window.location.href = `/api/auth/workos/login?${params.toString()}`;
  };

  const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanEmail = resetEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setResetError('Enter your email address.');

      return;
    }

    setResetError(null);

    try {
      setIsResetSubmitting(true);
      await fetch('/api/auth/workos/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail }),
      });
      toast.success('If that account exists, a password reset email has been sent.');
      setMode('login');
    } catch {
      toast.error('Password reset could not be requested. Please try again.');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const returnToLogin = () => {
    setMode('login');
    setStep('email');
  };

  // Harvey opens on its loader and only then shows the form. The same here:
  // until the session check answers, and again once it answers "logged in"
  // (the redirect to the app is in flight), the page is the loader, not a
  // form that would flash and vanish. Light, not dark: Harvey's loader is
  // the app's theme, and the app is light -- the dark ground begins with
  // the form.
  if (sessionLoading || user) {
    return <AppLoader tone="light" />;
  }

  const subtitle =
    mode === 'sso'
      ? 'Log in with your company SSO to continue.'
      : mode === 'forgot'
        ? 'Enter your email and we will send reset instructions.'
        : mode === 'verify'
          ? `Enter the code we sent to ${verificationEmail || 'your email'}.`
          : 'Log in to Sculptors to continue.';

  return (
    <AuthScreen
      heading="Welcome"
      subtitle={subtitle}
      aside={
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f1e1c',
              color: INK,
              border: `1px solid ${MUTED}`,
              borderRadius: '4px',
              padding: '14px 16px',
              fontSize: '14px',
              maxWidth: '360px',
            },
          }}
        />
      }
    >
      <div className="mt-6">
        {mode === 'login' && step === 'email' ? (
          <form onSubmit={handleEmailContinue} noValidate>
            <FloatingField
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              label={
                <>
                  Email address
                  <Required />
                </>
              }
              error={errors.email?.message}
              {...register('email')}
            />
            <button type="submit" className={continueClassName}>
              Continue
            </button>
          </form>
        ) : null}

        {mode === 'login' && step === 'password' ? (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {/* The email carried over from the first step, shown the way
                Harvey shows it: a quiet field with an Edit action that
                steps back rather than a second editable input. */}
            <FloatingField
              id="email-review"
              type="email"
              value={getValues('email')}
              readOnly
              disabled
              label="Email address"
              trailing={
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-[14px] text-[#fafaf9] underline-offset-4 hover:underline"
                >
                  Edit
                </button>
              }
            />
            <FloatingField
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              label={
                <>
                  Password
                  <Required />
                </>
              }
              error={errors.password?.message}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-[#8f8b85] transition-colors hover:text-[#fafaf9]"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              }
              {...register('password')}
            />
            <div>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[14px] text-[#fafaf9] underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={cn(continueClassName, 'mt-2')}
            >
              {isSubmitting ? 'Logging in…' : 'Continue'}
            </button>
          </form>
        ) : null}

        {mode === 'sso' ? (
          <form onSubmit={handleSSOSubmit} noValidate>
            <FloatingField
              id="sso-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={ssoEmail}
              onChange={(event) => setSsoEmail(event.target.value)}
              label={
                <>
                  Company email
                  <Required />
                </>
              }
              error={ssoError ?? undefined}
            />
            <button
              type="submit"
              disabled={isSSOSubmitting}
              aria-busy={isSSOSubmitting}
              className={continueClassName}
            >
              {isSSOSubmitting ? 'Opening SSO…' : 'Continue'}
            </button>
          </form>
        ) : null}

        {mode === 'forgot' ? (
          <form onSubmit={handlePasswordReset} noValidate>
            <FloatingField
              id="reset-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              label={
                <>
                  Email address
                  <Required />
                </>
              }
              error={resetError ?? undefined}
            />
            <button
              type="submit"
              disabled={isResetSubmitting}
              aria-busy={isResetSubmitting}
              className={continueClassName}
            >
              {isResetSubmitting ? 'Sending…' : 'Continue'}
            </button>
          </form>
        ) : null}

        {mode === 'verify' ? (
          <form onSubmit={handleEmailVerification} noValidate>
            <FloatingField
              id="verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              label={
                <>
                  Verification code
                  <Required />
                </>
              }
            />
            <button
              type="submit"
              disabled={isVerifying || verificationCode.trim().length === 0}
              aria-busy={isVerifying}
              className={continueClassName}
            >
              {isVerifying ? 'Verifying…' : 'Continue'}
            </button>
          </form>
        ) : null}
      </div>

      {/* Harvey's page ends at the button. Ours cannot: the product has
          SSO and self-serve sign-up, and a login page that hides them is a
          dead end. They sit below in the muted tone so the composition
          above stays Harvey's. */}
      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        {mode === 'login' ? (
          <>
            <button type="button" onClick={() => setMode('sso')} className={quietLinkClassName}>
              Continue with company SSO
            </button>
            <p className={quietLinkClassName}>
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-[#fafaf9] underline-offset-4 hover:underline">
                Sign up
              </Link>
            </p>
          </>
        ) : (
          <button type="button" onClick={returnToLogin} className={quietLinkClassName}>
            Back to log in
          </button>
        )}
      </div>
    </AuthScreen>
  );
}
