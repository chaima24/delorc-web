import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import type { ActivityChange, ActivityLine } from '@/api/central/activityLog'
import { useAccessLabels } from '@/composables/useAccessLabels'
import { useAuthStore } from '@/stores/auth'
import { recentDay } from './activity'

/** Turns a line of the log into words. The API sends codes; the sentences live in the JSON texts. */
export function useActivityTexts() {
  const { t, te, d } = useI18n()
  const auth = useAuthStore()
  const { roleLabel, resourceLabel, actionLabel } = useAccessLabels()

  const known = (key: string, fallback: string) => (te(key) ? t(key) : fallback)
  const isRights = (line: ActivityLine) => line.action === 'access_changed'

  function rightLabel(permission: string): string {
    const [resource = '', action = ''] = permission.split('.')

    return t('central.activity.right', { resource: resourceLabel(resource), action: actionLabel(action).toLowerCase() })
  }

  // A plan's values are logged by feature key ("users.max"): their names are the feature texts.
  const isPlanValues = (line: ActivityLine) => line.action === 'values_changed'

  function fieldLabel(line: ActivityLine, field: string): string {
    if (isRights(line)) return rightLabel(field)
    if (isPlanValues(line)) return known(`features.${field}.name`, field)

    return known(`central.activity.field.${field}`, field)
  }

  function valueLabel(line: ActivityLine, field: string, value: unknown): string {
    if (isRights(line)) return t(value ? 'central.activity.yes' : 'central.activity.no')
    if (isPlanValues(line) && value === null) return t('central.plans.unlimited')
    if (isPlanValues(line) && typeof value === 'boolean') return t(value ? 'central.plans.included' : 'central.plans.notIncluded')
    if (value === null || value === undefined || value === '') return '—'
    if (field === 'is_active') return t(`central.users.status.${value ? 'active' : 'inactive'}`)
    if (field === 'role') return roleLabel(String(value))
    if (field === 'second_factor') return known(`central.users.factor.${value}`, String(value))
    if (field === 'locale' && line.record_type === 'person') return known(`common.locale.${value}`, String(value))
    if (field === 'fallback') return known(`common.locale.${value}`, String(value))
    if (field === 'direction') return known(`central.languages.direction.${value}`, String(value))

    return String(value)
  }

  function chip(line: ActivityLine, change: ActivityChange): string {
    if (isRights(line)) {
      return t(`central.activity.${change.after ? 'rightAdded' : 'rightRemoved'}`, { right: rightLabel(change.field) })
    }

    return t('central.activity.change', {
      field: fieldLabel(line, change.field),
      before: valueLabel(line, change.field, change.before),
      after: valueLabel(line, change.field, change.after),
    })
  }

  function chips(line: ActivityLine): string[] {
    if (line.attempt) return [t(`central.activity.reason.${line.attempt.reason}`)]
    if (line.import && line.record_type === 'country') {
      const { regions_added: regions = 0, wilayas_added: wilayas = 0, communes_added: communes = 0 } = line.import

      return [t('central.activity.importedPlaces', { regions, wilayas, communes })]
    }
    if (line.import) return [t('central.activity.imported', { keys: line.import.keys_added ?? 0, texts: line.import.texts_added ?? 0 })]

    return line.changes.map((change) => chip(line, change))
  }

  /** A role made on the screen has no translation: its own name shows. */
  function recordName(line: ActivityLine): string {
    if (line.attempt) return line.attempt.email
    const name = line.record?.name ?? '—'

    return line.record_type === 'role' ? roleLabel(name) : name
  }

  /** Where "Open" goes, or null when the record is gone or this person cannot see it. */
  function recordLink(line: ActivityLine): RouteLocationRaw | null {
    if (!line.record?.exists) return null
    if (line.record_type === 'person' && auth.can('users.show')) return { name: 'central-users', query: { open: line.record.id } }
    if (line.record_type === 'role' && auth.can('roles.show')) return { name: 'central-roles', query: { open: line.record.id } }
    if (line.record_type === 'country' && auth.can('geography.show')) return { name: 'central-countries', query: { open: line.record.id } }
    if (line.record_type === 'plan' && auth.can('plans.show')) return { name: 'central-plans', query: { open: line.record.id } }
    if (line.record_type === 'language' && auth.can('languages.show')) return { name: 'central-languages', query: { open: line.record.id } }

    return null
  }

  function dayLabel(day: string): string {
    const recent = recentDay(day)

    return recent ? t(`central.activity.${recent}`) : d(new Date(`${day}T12:00:00`), { dateStyle: 'long' })
  }

  const timeLabel = (line: ActivityLine) => d(new Date(line.created_at), { hour: '2-digit', minute: '2-digit' })

  return { chips, dayLabel, fieldLabel, recordLink, recordName, timeLabel, valueLabel }
}
