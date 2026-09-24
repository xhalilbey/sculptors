'use client';

import Link from 'next/link';
import React, { Component, type ReactNode } from 'react';
import { ErrorScene } from '@/components/errors/error-scene';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // The one place a caught render error is logged; onError is for
    // callers that need to react to it, not to log it again.
    logger.error('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

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
