import type { PermissionCatalog } from '@/api/tenant/roles'

/**
 * Readable names for the API's permissions (`{resource}.{action}`, e.g. `visits.show`), grouped in the
 * areas of the API's catalog (`GET permissions`). Labels are i18n keys:
 * `access.area.{area}`, `access.resource.{resource}`, `access.action.{action}`.
 * A permission is identified by its name.
 */

/** The four usual actions, in column order. */
export const MAIN_ACTIONS = ['show', 'create', 'update', 'delete'] as const
export type MainAction = (typeof MAIN_ACTIONS)[number]

/** One resource in the access grid: its permission per usual action, and any other actions. */
export interface AccessResource {
  key: string
  main: Partial<Record<MainAction, string>>
  /** Other actions (e.g. `change-role`), each with its permission name. */
  extra: { action: string; id: string }[]
}

export interface AccessArea {
  key: string
  resources: AccessResource[]
}

/** The API's catalog as areas → resources → actions, in catalog order. */
export function buildAreas(catalog: PermissionCatalog): AccessArea[] {
  return Object.entries(catalog).map(([area, resources]) => ({
    key: area,
    resources: Object.entries(resources).map(([key, actions]) => {
      const resource: AccessResource = { key, main: {}, extra: [] }
      for (const action of actions) {
        if ((MAIN_ACTIONS as readonly string[]).includes(action)) resource.main[action as MainAction] = `${key}.${action}`
        else resource.extra.push({ action, id: `${key}.${action}` })
      }

      return resource
    }),
  }))
}

export const resourceIds = (resource: AccessResource) => [...Object.values(resource.main), ...resource.extra.map(e => e.id)]
export const areaIds = (area: AccessArea) => area.resources.flatMap(resourceIds)

/** none · view · some (view and some changes) · full (everything in the area). */
export type AccessLevel = 'none' | 'view' | 'some' | 'full'

export function areaLevel(area: AccessArea, granted: Set<string>): AccessLevel {
  const ids = areaIds(area)
  const count = ids.filter(id => granted.has(id)).length
  if (!count) return 'none'
  if (count === ids.length) return 'full'
  const changes = area.resources.some(resource =>
    (['create', 'update', 'delete'] as const).some(action => resource.main[action] != null && granted.has(resource.main[action]!))
    || resource.extra.some(extra => granted.has(extra.id)))
  return changes ? 'some' : 'view'
}

/** The whole role in one level, from its areas. */
export function overallLevel(levels: AccessLevel[]): AccessLevel {
  if (levels.every(level => level === 'full')) return 'full'
  if (levels.every(level => level === 'none')) return 'none'
  return levels.some(level => level === 'some' || level === 'full') ? 'some' : 'view'
}

/** "campaign-dispatches" → "Campaign dispatches", for resources without a label yet. */
export function humanize(key: string): string {
  const text = key.replace(/[-_]/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
