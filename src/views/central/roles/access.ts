import type { PermissionCatalog } from '@/api/central/roles'

/** The four actions shown as columns. Anything else is shown as a chip. */
export const MAIN_ACTIONS = ['show', 'create', 'update', 'delete']

export type AccessLevel = 'none' | 'view' | 'some' | 'full'

type Resources = PermissionCatalog[string]

export function permissionsOf(resources: Resources): string[] {
  return Object.entries(resources).flatMap(([resource, actions]) => actions.map((action) => `${resource}.${action}`))
}

/** How much of an area a role has, for the four little squares. */
export function areaLevel(resources: Resources, granted: string[]): AccessLevel {
  const all = permissionsOf(resources)
  const held = all.filter((name) => granted.includes(name))

  if (held.length === 0) return 'none'
  if (held.length === all.length) return 'full'

  return held.every((name) => name.endsWith('.show')) ? 'view' : 'some'
}

/** Ticks or unticks one box: any action needs View, and removing View removes the whole resource. */
export function toggle(granted: string[], permission: string, resourceActions: string[]): string[] {
  const resource = permission.split('.')[0]
  const view = `${resource}.show`

  if (!granted.includes(permission)) {
    return [...new Set([...granted, permission, ...(resourceActions.includes('show') ? [view] : [])])]
  }
  if (permission === view) {
    return granted.filter((name) => !name.startsWith(`${resource}.`))
  }

  return granted.filter((name) => name !== permission)
}
