import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The tab reads "Log in | Sculptors", the way Harvey's does. The page itself
// is a client component and cannot carry metadata, so the one-line layout
// does.
export const metadata: Metadata = {
  title: 'Log in | Sculptors',
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
