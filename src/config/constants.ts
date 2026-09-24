import {
  ContactRound,
  Headphones,
  LayoutGrid,
  Package,
  ShoppingBag,
  Workflow,
} from 'lucide-react';
import type { NavigationGroup } from '@/types';

/** Default route after login and for authenticated root visits. */
export const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';

/**
 * The rail's Store side (Store | Ads; Ads is not open yet). The landing
 * page's product mockup draws its rail from this list too, so it shows the
 * pages the app has.
 */
export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    // The three lead rows are where a person goes first -- how the agents
    // are doing, the agents themselves, and the pipelines that feed them --
    // so they lead the rail, set a little apart from the rest (owner's
    // direction, 23 Sep 2026; they sat in a raised block until the owner
    // dropped the block the same day).
    title: 'Main',
    items: [
      {
        title: 'Overview',
        href: '/dashboard',
        icon: LayoutGrid,
        lead: true,
      },
      {
        title: 'Agent Suite',
        href: '/agent-center',
        icon: Headphones,
        lead: true,
      },
      {
        title: 'Pipelines',
        href: '/pipelines',
        icon: Workflow,
        lead: true,
      },
      {
        title: 'Products',
        href: '/products',
        icon: Package,
      },
      {
        title: 'Customers',
        href: '/customers',
        icon: ContactRound,
      },
      {
        title: 'Orders',
        href: '/orders',
        icon: ShoppingBag,
      },
    ],
  },
  // The old product's sections (Enterprise Agent, Automations, Marketing
  // Brain, Trend Radar, Library) were deleted from the tree on 22 Sep 2026;
  // see docs/DECISIONS.md.
];
