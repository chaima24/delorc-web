import type { RouteLocationRaw } from 'vue-router'

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
 * (module 2 adds Users, Teams and Roles). A workspace with no link the person may open is not shown.
 */
export const workspaces: Workspace[] = []

export function routeName(link: NavLink): string | undefined {
  const to = link.to as { name?: string } | undefined

  return typeof to?.name === 'string' ? to.name : undefined
}
