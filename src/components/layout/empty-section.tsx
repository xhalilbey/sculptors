/**
 * A section that exists in the navigation before it exists as a product.
 *
 * It paints nothing of its own: the content panel's dark ground shows
 * through, so an empty section is the panel it sits in rather than a second
 * surface inside it.
 *
 * Deliberately not a "coming soon" splash: it states the section's name and
 * nothing else, so nobody reads a promise into it and no placeholder copy has
 * to be found and deleted later. When the real page arrives it replaces this
 * component's usage, not its contents.
 */
export function EmptySection({ title }: { title: string }) {
  return (
    <section className="flex min-h-full flex-col px-6 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
    </section>
  );
}
