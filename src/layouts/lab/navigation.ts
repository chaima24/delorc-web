import type { RouteLocationRaw } from 'vue-router'
import { settingsPages } from '@/views/tenant/settings/settingsGroups'

/** A menu entry: text key, route and Tabler icon. `resource` hides it without `{resource}.show`. */
export interface NavLink {
  title: string
  to: RouteLocationRaw
  icon: string
  resource?: string
  /** A full permission the entry needs when it is not `{resource}.show` (`visits.validate`). */
  permission?: string
  /** Other pages that belong to this entry (detail pages, sub-pages). */
  matches?: string[]
  /** The lab's plan switch it needs (`module.expenses`): hidden without it. */
  feature?: string
}

export interface Workspace {
  id: string
  /** Text key. */
  title: string
  icon: string
  links: NavLink[]
}

/**
 * The lab's workspaces, in workflow order. Only built pages appear here: each module adds its links
 * (2b Users, 2c Teams and Brands, organisations). A workspace with no link the person may open is not shown.
 */
export const workspaces: Workspace[] = [
  {
    id: 'studio',
    title: 'nav.workspaces.studio',
    icon: 'tabler-adjustments',
    links: [
      // Paramètres: the Studio home and every settings page it opens.
      { title: 'nav.settings', to: { name: 'tenant-settings' }, icon: 'tabler-settings', matches: settingsPages },
      { title: 'nav.organization.users', to: { name: 'tenant-users' }, icon: 'tabler-user-cog', resource: 'users', matches: ['tenant-user-detail'] },
      { title: 'nav.organization.teams', to: { name: 'tenant-teams' }, icon: 'tabler-users-group', resource: 'teams' },
      { title: 'nav.catalog.brands', to: { name: 'tenant-brands' }, icon: 'tabler-tags', resource: 'brands' },
      { title: 'nav.catalog.products', to: { name: 'tenant-products' }, icon: 'tabler-pill', resource: 'products', matches: ['tenant-product-detail'] },
    ],
  },
  {
    // Planifier: territories, cycles, activities, objectives, frequencies.
    id: 'plan',
    title: 'nav.workspaces.plan',
    icon: 'tabler-calendar-stats',
    links: [
      { title: 'nav.plan.territories', to: { name: 'tenant-territories' }, icon: 'tabler-map-pins', resource: 'territories', matches: ['tenant-territory-detail', 'tenant-territory-new', 'tenant-territory-covers'] },
      { title: 'nav.plan.cycles', to: { name: 'tenant-cycles' }, icon: 'tabler-rotate-clockwise-2', resource: 'cycles', matches: ['tenant-cycle-detail', 'tenant-cycle-create'] },
      { title: 'nav.plan.activities', to: { name: 'tenant-activities' }, icon: 'tabler-calendar-event', resource: 'activities' },
      { title: 'nav.plan.objectives', to: { name: 'tenant-objectives' }, icon: 'tabler-target-arrow', resource: 'objectives' },
      { title: 'nav.plan.frequencies', to: { name: 'tenant-frequencies' }, icon: 'tabler-repeat', resource: 'frequencies' },
    ],
  },
  {
    // Professionnels de santé.
    id: 'customers',
    title: 'nav.workspaces.customers',
    icon: 'tabler-users',
    links: [
      { title: 'nav.organization.hcps', to: { name: 'tenant-hcps' }, icon: 'tabler-stethoscope', resource: 'hcps', matches: ['tenant-hcp-detail', 'tenant-hcp-import', 'tenant-hcp-duplicates', 'tenant-hcp-merge', 'tenant-hcp-requests', 'tenant-hcp-proposals'] },
      { title: 'nav.organization.hcos', to: { name: 'tenant-hcos' }, icon: 'tabler-building-hospital', resource: 'hcos' },
      { title: 'nav.organization.consents', to: { name: 'tenant-consents' }, icon: 'tabler-shield-check', resource: 'consents' },
    ],
  },
  {
    // Visites (docs/api/visits.md) and their planning calendar (docs/api/visit-planning.md).
    id: 'visits',
    title: 'nav.workspaces.visits',
    icon: 'tabler-map-pin-check',
    links: [
      { title: 'nav.visits.visits', to: { name: 'tenant-visits' }, icon: 'tabler-map-pin-check', resource: 'visits', matches: ['tenant-visit-new', 'tenant-visit-detail', 'tenant-visit-report'] },
      { title: 'nav.visits.planning', to: { name: 'tenant-visit-planning' }, icon: 'tabler-calendar-week', resource: 'visits' },
      // The approval of the cycles' plans (docs/api/visit-approval.md): for the people who approve.
      { title: 'nav.visits.plans', to: { name: 'tenant-visit-plans' }, icon: 'tabler-checklist', permission: 'visits.validate' },
    ],
  },
  {
    // Engager: what reps show and hand out (docs/api/advs.md); campaigns and materials later.
    id: 'engage',
    title: 'nav.workspaces.engage',
    icon: 'tabler-presentation',
    links: [
      { title: 'nav.catalog.advs', to: { name: 'tenant-advs' }, icon: 'tabler-presentation', resource: 'advs' },
    ],
  },
  {
    // Coaching: the sessions (docs/api/coaching-sessions.md) and their setup (docs/api/coaching-setup.md).
    id: 'coaching',
    title: 'nav.workspaces.coaching',
    icon: 'tabler-school',
    links: [
      { title: 'nav.coaching.sessions', to: { name: 'tenant-coaching-sessions' }, icon: 'tabler-school', resource: 'coaching-sessions', matches: ['tenant-coaching-session', 'tenant-coaching-session-fill'] },
      { title: 'nav.coaching.programs', to: { name: 'tenant-coachings' }, icon: 'tabler-calendar-user', resource: 'coaching-setup', matches: ['tenant-coaching-detail'] },
      { title: 'nav.coaching.grid', to: { name: 'tenant-coaching-grid' }, icon: 'tabler-list-check', resource: 'coaching-setup' },
      { title: 'nav.coaching.settings', to: { name: 'tenant-coaching-settings' }, icon: 'tabler-settings', resource: 'coaching-setup' },
    ],
  },
  {
    // Équipe: expenses (docs/api/expenses.md).
    id: 'team',
    title: 'nav.workspaces.team',
    icon: 'tabler-users-group',
    links: [
      { title: 'nav.expenses.expenses', to: { name: 'tenant-expenses' }, icon: 'tabler-receipt-tax', resource: 'expenses', feature: 'module.expenses', matches: ['tenant-expense-mine', 'tenant-expense-month', 'tenant-expense-new', 'tenant-expense-edit'] },
    ],
  },
]

export function routeName(link: NavLink): string | undefined {
  const to = link.to as { name?: string } | undefined

  return typeof to?.name === 'string' ? to.name : undefined
}
