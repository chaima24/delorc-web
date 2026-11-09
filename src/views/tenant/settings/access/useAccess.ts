import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { rolesApi, type PermissionCatalog, type Role } from '@/api/tenant/roles'
import { areaIds, areaLevel, buildAreas, humanize, overallLevel, type AccessArea, type AccessLevel } from './accessCatalog'

/** Every permission, and every role with the permissions it has (by name). */
export interface AccessOverview {
  permissions: PermissionCatalog
  roles: (Pick<Role, 'id' | 'name' | 'built_in' | 'users_count'> & { permission_ids: string[] })[]
}

async function fetchAccessOverview(): Promise<AccessOverview> {
  const [permissions, roles] = await Promise.all([rolesApi.permissions(), rolesApi.list()])

  return { permissions, roles: roles.map((role) => ({ ...role, permission_ids: role.permissions })) }
}

/** Every permission and every role's access, loaded once per page. */
export function useAccessOverview() {
  const overview = shallowRef<AccessOverview | null>(null)
  const failed = shallowRef(false)

  async function load() {
    try {
      overview.value = await fetchAccessOverview()
      failed.value = false
    }
    catch {
      failed.value = true
    }
  }
  load()

  const areas = computed<AccessArea[]>(() => buildAreas(overview.value?.permissions ?? {}))

  return { overview, areas, failed, load }
}

/** Whether a translation exists (the lab's texts are nested, so vue-i18n's `te()` finds them). */
export function useHasMessage() {
  const { te } = useI18n()

  return (key: string) => te(key)
}

/** Readable labels for areas, resources and actions; unknown ones are humanized. */
export function useAccessLabels() {
  const { t } = useI18n()
  const has = useHasMessage()
  const label = (key: string, fallback: string) => (has(key) ? t(key) : fallback)

  return {
    area: (key: string) => label(`access.area.${key}`, humanize(key)),
    resource: (key: string) => label(`access.resource.${key}`, humanize(key)),
    action: (key: string) => label(`access.action.${key}`, humanize(key)),
    level: (level: AccessLevel) => t(`access.level.${level}`),
  }
}

/** One line per area for a role: its level, and in short how much it can do. */
export function summarize(areas: AccessArea[], granted: Set<string>) {
  const rows = areas.map(area => ({ key: area.key, level: areaLevel(area, granted) }))
  return {
    rows,
    level: overallLevel(rows.map(row => row.level)),
    areas: rows.filter(row => row.level !== 'none').length,
    actions: areas.flatMap(areaIds).filter(id => granted.has(id)).length,
  }
}
