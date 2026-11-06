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

  const fieldLabel = (line: ActivityLine, field: string) =>
    isRights(line) ? rightLabel(field) : known(`central.activity.field.${field}`, field)

  function valueLabel(line: ActivityLine, field: string, value: unknown): string {
    if (isRights(line)) return t(value ? 'central.activity.yes' : 'central.activity.no')
    if (value === null || value === undefined || value === '') return '—'
    if (field === 'is_active') return t(`central.users.status.${value ? 'active' : 'inactive'}`)
    if (field === 'role') return roleLabel(String(value))
    if (field === 'second_factor') return known(`central.users.factor.${value}`, String(value))
    if (field === 'locale') return known(`common.locale.${value}`, String(value))

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

  const chips = (line: ActivityLine): string[] =>
    line.attempt ? [t(`central.activity.reason.${line.attempt.reason}`)] : line.changes.map((change) => chip(line, change))

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

    return null
  }

  function dayLabel(day: string): string {
    const recent = recentDay(day)

    return recent ? t(`central.activity.${recent}`) : d(new Date(`${day}T12:00:00`), { dateStyle: 'long' })
  }

  const timeLabel = (line: ActivityLine) => d(new Date(line.created_at), { hour: '2-digit', minute: '2-digit' })

  return { chips, dayLabel, fieldLabel, recordLink, recordName, timeLabel, valueLabel }
}
