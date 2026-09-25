'use client';

import Link from 'next/link';
import React, { Component, type ReactNode } from 'react';
import { ErrorScene } from '@/components/errors/error-scene';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 *
 * It used to take a `fallback` and an `onError` prop and keep a `hasError`
 * flag beside the error. Its one caller (AppProviders) passes neither, and
 * the flag said nothing the error did not, so all three went.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // The one place a caught render error is logged.
    logger.error('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      // The app's error scene. It used to say "Unable to connect to
      // Sculptors", which is not what a render error is.
      return (
        <ErrorScene
          code="500"
          eyebrow="Something went wrong"
          title="Something broke on our side."
          body="It is nothing you did. Try again; if it keeps happening, give it a few minutes."
          actions={
            <>
              <button type="button" onClick={this.reset} className="btn-brand">
                Try again
              </button>
              <Link href="/" className="btn-ghost">
                Back home
              </Link>
            </>
          }
        />
      );
    }

    return this.props.children;
  }
}
