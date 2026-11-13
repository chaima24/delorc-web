import { useI18n } from 'vue-i18n'
import type { ExpenseSettingRef, ExpenseStatus } from '@/api/tenant/expenses'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

export { shiftMonth } from '@/views/tenant/activities/activityDisplay'

export const STATUS_TONE: Record<ExpenseStatus, 'success' | 'warning' | 'danger'> = { approved: 'success', pending: 'warning', rejected: 'danger' }

/** Bar colours of the board's "days by status" (approved, waiting, refused). */
export const STATUS_BAR: Record<ExpenseStatus, string> = { approved: 'bg-dl-signal', pending: 'bg-dl-pending', rejected: 'bg-dl-rejected' }

const noon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`)

export function useExpenseText() {
  const { t, n, d } = useI18n()
  return {
    money: (value: number) => t('expenses.money', { amount: n(Math.round(value * 100) / 100, { maximumFractionDigits: 2 }) }),
    km: (value: number) => n(Math.round(value * 100) / 100, { maximumFractionDigits: 2 }),
    month: (month: string) => d(noon(`${month}-01`), { month: 'long', year: 'numeric' }),
    day: (iso: string) => d(noon(iso), { weekday: 'short', day: 'numeric', month: 'short' }),
    dayLong: (iso: string) => d(noon(iso), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    status: (status: ExpenseStatus) => t(`expenses.status.${status}`),
    roles: (roles?: string[]) => (roles ?? []).map(roleLabel).join(', '),
    route: (route: string[]) => route.join(' → ') || '—',
    /** "Karim Bensaïd", "VM · Cardio", or "everyone". */
    setting: (setting: ExpenseSettingRef) => setting.person
      ?? ([setting.role ? roleLabel(setting.role) : null, setting.team].filter(Boolean).join(' · ') || t('expenses.setting.everyone')),
    /** "6–7 Oct" or "19 Oct". */
    span: (from: string, to: string) => (from === to
      ? d(noon(from), { day: 'numeric', month: 'short' })
      : `${d(noon(from), { day: 'numeric' })}–${d(noon(to), { day: 'numeric', month: 'short' })}`),
  }
}
