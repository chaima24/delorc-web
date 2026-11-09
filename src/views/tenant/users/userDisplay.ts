import { useI18n } from 'vue-i18n'
import type { TenantUser, UserAccountStatus } from '@/api/tenant/users'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

// Teams, managers and territory (with their dates) come back here with their modules.

export const today = () => new Date().toISOString().slice(0, 10)

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
  }
}
