import { useI18n } from 'vue-i18n'
import type { MailChannel, MessageStatus } from '@/api/tenant/campaignMessages'

export const STATUS_TONE: Record<MessageStatus, 'neutral' | 'info' | 'danger' | 'success'> = { draft: 'neutral', ready: 'info', returned: 'danger', approved: 'success' }
export const CHANNEL_ICON: Record<MailChannel, string> = { email: 'tabler-mail', sms: 'tabler-message-2' }

/** Dates, states and channels of a message, as the pages show them. */
export function useMessageText() {
  const { t, d } = useI18n()

  return {
    date: (value?: string | null) => (value ? d(new Date(value), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
    dateTime: (value?: string | null) => (value ? d(new Date(value), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'),
    status: (status: MessageStatus) => t(`campaignMessages.status.${status}`),
    channel: (channel: MailChannel) => t(`campaignMessages.channel.${channel}`),
  }
}
