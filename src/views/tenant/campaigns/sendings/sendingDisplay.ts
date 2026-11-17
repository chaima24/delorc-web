import { useI18n } from 'vue-i18n'
import type { RecipientStatus, SendingStatus } from '@/api/tenant/campaignSendings'

export const SENDING_TONE: Record<SendingStatus, 'info' | 'warning' | 'success' | 'neutral' | 'danger'> = {
  scheduled: 'info', running: 'warning', done: 'success', cancelled: 'neutral', failed: 'danger',
}
export const RECIPIENT_TONE: Record<RecipientStatus, 'neutral' | 'success' | 'danger'> = { pending: 'neutral', sent: 'success', failed: 'danger', cancelled: 'neutral' }

/** Dates and states of a sending, as the pages show them. */
export function useSendingText() {
  const { t, d } = useI18n()

  return {
    dateTime: (value?: string | null) => (value ? d(new Date(value), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'),
    short: (value?: string | null) => (value ? d(new Date(value), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'),
    status: (status: SendingStatus) => t(`campaignSendings.status.${status}`),
    recipient: (status: RecipientStatus) => t(`campaignSendings.recipientStatus.${status}`),
    percent: (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0),
  }
}
