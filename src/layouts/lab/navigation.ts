import type { RouteLocationRaw } from 'vue-router'
import { settingsPages } from '@/views/tenant/settings/settingsGroups'

/** A menu entry: text key, route and Tabler icon. `resource` hides it without `{resource}.show`. */
export interface NavLink {
  title: string
  to: RouteLocationRaw
  icon: string
  resource?: string
  /** Other pages that belong to this entry (detail pages, sub-pages). */
  matches?: string[]
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
]

export function routeName(link: NavLink): string | undefined {
  const to = link.to as { name?: string } | undefined

  return typeof to?.name === 'string' ? to.name : undefined
}
