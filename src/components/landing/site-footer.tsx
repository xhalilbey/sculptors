import Link from 'next/link';
import { LandingThemeSwitch } from '@/components/landing/landing-theme';

/**
 * The page's last band, in legathon-tanitim's shape: three columns of links,
 * a line of small print, and then the wordmark set oversized and shown
 * whole, the last thing on the page.
 *
 * The wordmark is sized in vw so it always spans the page rather than
 * sitting at some fixed size that only looks right on one screen. The
 * negative bottom margin pulls the band up to the letters' baseline: a font
 * this large carries a lot of empty descender space, and without it the
 * page appears to end in a stripe of nothing.
 */
const COLUMNS = [
  {
    title: 'PLATFORM',
    links: [
      { label: 'Agent Store', href: '#agent-store' },
      { label: 'Integrate', href: '#memory' },
      { label: 'Engines', href: '#engines' },
      { label: 'Events', href: '#integrations' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'COMPANY',
    links: [
      { label: 'Book a demo', href: 'https://cal.com/halil-eren-pdniuc/30min' },
      { label: 'Get started', href: '/auth/login' },
    ],
  },
  {
    title: 'CONTACT',
    links: [{ label: 'hello@sculptors.ai', href: 'mailto:hello@sculptors.ai' }],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          {COLUMNS.map(column => (
            <div key={column.title}>
              <h4>{column.title}</h4>
              <ul>
                {column.links.map(link => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link href={link.href}>{link.label}</Link>
                    ) : (
                      <a
                        href={link.href}
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="site-footer-tagline">
          The Agent Store. <em>Autonomous sales intelligence.</em>
        </p>

        <div className="site-footer-bottom">
          <span>© 2026 Sculptors</span>
          {/* The page's light | dark switch lives here, at the very bottom,
              where the owner asked for it. */}
          <LandingThemeSwitch />
          <span>Istanbul</span>
        </div>

        <p className="site-footer-wordmark" aria-hidden="true">
          Sculptors
        </p>
      </div>
    </footer>
  );
}
