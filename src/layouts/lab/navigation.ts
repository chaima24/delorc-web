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
    // Professionnels de santé: professionals and consents join with their modules.
    id: 'customers',
    title: 'nav.workspaces.customers',
    icon: 'tabler-users',
    links: [
      { title: 'nav.organization.hcos', to: { name: 'tenant-hcos' }, icon: 'tabler-building-hospital', resource: 'hcos' },
    ],
  },
]

export function routeName(link: NavLink): string | undefined {
  const to = link.to as { name?: string } | undefined

  return typeof to?.name === 'string' ? to.name : undefined
}
