import { useI18n } from 'vue-i18n'
import type { TicketStatus } from '@/api/central/tickets'

export { TICKET_TONE as COMPLAINT_TONE } from '@/views/shared/tickets/ticketDisplay'

/** Photos and PDF, 10 MB each. */
export const COMPLAINT_FILE_TYPES = 'image/jpeg,image/png,image/webp,application/pdf'
export const COMPLAINT_MAX_BYTES = 10 * 1024 * 1024

export function useComplaintText() {
  const { t } = useI18n()

  return {
    status: (status: TicketStatus) => t(`complaints.status.${status}`),
    author: (user: { name: string } | null) => user?.name ?? t('complaints.anonymous'),
  }
}
