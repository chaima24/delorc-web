import { useI18n } from 'vue-i18n'
import type { TenantUser, UserAccountStatus } from '@/api/tenant/users'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

// The territory (with its dates) comes back here with its module.

/** A team or manager link with its dates (pivot). */
export interface Stint {
  id: number
  name: string
  start: string | null
  end: string | null
  isPrimary: boolean
}

export const today = () => new Date().toISOString().slice(0, 10)
const day = (value?: string | null) => (value ? value.slice(0, 10) : null)

type PivotRow = { id: number; name?: string; full_name?: string; pivot?: { start_date?: string | null; end_date?: string | null; is_primary?: boolean } }

/** Newest first: open stints on top, then by start date. */
export function stints(rows: PivotRow[] | undefined): Stint[] {
  return (rows ?? [])
    .map(row => ({
      id: row.id,
      name: row.full_name ?? row.name ?? '—',
      start: day(row.pivot?.start_date),
      end: day(row.pivot?.end_date),
      isPrimary: !!row.pivot?.is_primary,
    }))
    .sort((a, b) => Number(!!a.end) - Number(!!b.end) || (b.start ?? '').localeCompare(a.start ?? ''))
}

/** Not ended: today, or starting later (a person added for next week already has a team). */
export const isOpen = (stint: Stint) => !stint.end || stint.end >= today()

export function currentTeams(user: TenantUser) {
  return stints(user.teams).filter(isOpen).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
}

export const currentManagers = (user: TenantUser) => stints(user.managers).filter(isOpen)
export const userRole = (user: TenantUser) => user.role

export const accountStatus = (user: TenantUser): UserAccountStatus => user.account_status

export const STATUS_TONES: Record<UserAccountStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  active: 'success',
  invited: 'info',
  not_invited: 'warning',
  inactive: 'neutral',
}

export function useUserText() {
  const { t, d } = useI18n()

  const date = (value?: string | null) =>
    value ? d(new Date(`${value.slice(0, 10)}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const dateTime = (value?: string | null) =>
    value ? d(new Date(value), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return {
    date,
    dateTime,
    role: (user: TenantUser) => roleLabel(user.role),
    status: (user: TenantUser) => t(`users.status.${accountStatus(user)}`),
    /** "2 Sep 2026 → today" */
    period: (stint: Stint) => stint.start && stint.start > today() && !stint.end
      ? t('users.history.startsOn', { date: date(stint.start) })
      : t('users.history.period', { from: date(stint.start), to: stint.end ? date(stint.end) : t('users.history.today') }),
    teams: (user: TenantUser) => currentTeams(user).map(team => team.name).join(' · ') || '—',
    managers: (user: TenantUser) => currentManagers(user).map(manager => manager.name).join(' · ') || '—',
  }
}
