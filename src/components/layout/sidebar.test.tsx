import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * The shell's light surfaces and the rail's sense of place, checked on the
 * server-rendered markup: the mobile header bar once used the black rail's
 * white text on its light ground, the avatar went through the image
 * optimizer, and the mobile title said "Overview" on pages it did not know.
 */

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { AvatarFace, getCurrentTitle, MobileNavigationButton } = await import('./sidebar');

describe('MobileNavigationButton', () => {
  // It once drew the rail's white text on a light bar. Its bar and its text
  // now come from the same theme tokens, so they cannot disagree.
  it('takes its bar, text and hover from the theme tokens', () => {
    const html = renderToStaticMarkup(<MobileNavigationButton title="Settings" onClick={() => undefined} />);

    expect(html).toContain('bg-[var(--color-rail)]');
    expect(html).toContain('text-[var(--dashboard-text)]');
    expect(html).toContain('hover:bg-[var(--dashboard-fill-strong)]');
  });
});

describe('getCurrentTitle', () => {
  it.each([
    ['/dashboard', 'Overview'],
    ['/agent-center', 'Agent Suite'],
    ['/orders', 'Orders'],
    ['/settings', 'Settings'],
  ])('names %s after its rail entry', (pathname, title) => {
    expect(getCurrentTitle(pathname)).toBe(title);
  });

  it('gives a nested page to the longest entry that owns it, not its parent', () => {
    expect(getCurrentTitle('/settings/health')).toBe('Health');
    expect(getCurrentTitle('/settings/api/docs')).toBe('API docs');
  });

  it('gives a page without an entry of its own to the entry above it', () => {
    expect(getCurrentTitle('/dashboard/revenue')).toBe('Overview');
  });

  it('does not borrow the first entry for a page the rail does not know', () => {
    expect(getCurrentTitle('/integrations')).toBe('Integrations');
    expect(getCurrentTitle('/somewhere-else')).toBe('Sculptors');
  });

  it('does not treat a shared prefix as ownership', () => {
    expect(getCurrentTitle('/ordersheet')).toBe('Sculptors');
  });
});

describe('AvatarFace', () => {
  const avatarUrl = 'https://lh3.googleusercontent.com/a/ACg8ocL-example=s96-c';

  it('loads an external avatar directly, without the optimizer or a referrer', () => {
    const html = renderToStaticMarkup(<AvatarFace avatarUrl={avatarUrl} displayName="Ada Lovelace" avatarInitial="A" />);
    const img = /<img[^>]*>/.exec(html)?.[0] ?? '';

    expect(img).toContain(`src="${avatarUrl.replace(/&/g, '&amp;')}"`);
    // HTML attribute names are case-insensitive; React writes referrerPolicy.
    expect(img).toMatch(/referrerpolicy="no-referrer"/i);
    expect(img).not.toContain('/_next/image');
    expect(img).not.toContain('srcset');
  });

  it('falls back to the initial when the picture failed to load', () => {
    const html = renderToStaticMarkup(
      <AvatarFace avatarUrl={avatarUrl} displayName="Ada Lovelace" avatarInitial="A" failed />
    );

    expect(html).not.toContain('<img');
    expect(html).toMatch(/>A<\/span>$/);
  });

  it('shows the initial when there is no picture', () => {
    expect(renderToStaticMarkup(<AvatarFace avatarUrl={null} displayName="Ada" avatarInitial="A" />)).toMatch(/>A<\/span>$/);
  });
});
