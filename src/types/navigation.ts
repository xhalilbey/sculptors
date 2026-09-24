export interface NavItem {
  title: string;
  href: string;
  // The icons are lucide components, which take the full SVG prop set. Typing
  // this as className-only meant the sidebar could not set strokeWidth, so the
  // nav icons rendered at the default weight while the utility icons beside
  // them used 2.5 -- two line weights on one rail, enforced by a type.
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  disabled?: boolean;
  badge?: string;
  /**
   * Leads the rail, set a little apart from the rows below it: the few
   * places a person goes first (Overview, Agent Suite, Pipelines).
   */
  lead?: boolean;
}

export interface NavigationGroup {
  title?: string;
  items: NavItem[];
}
