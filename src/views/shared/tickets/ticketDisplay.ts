import { useI18n } from 'vue-i18n'
import type { TicketStatus } from '@/api/central/tickets'

/**
 * E-tickets, shown the same way in the lab and in central. The texts live under `tickets.*` in both places:
 * the lab's database texts and the console's JSON files.
 */
export const TICKET_TONE: Record<TicketStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'neutral',
}

/** Files a message may carry: photos, videos, PDF; 20 MB each, 5 per message. */
export const TICKET_FILE_TYPES = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf'
export const TICKET_MAX_FILES = 5
export const TICKET_MAX_BYTES = 20 * 1024 * 1024

export function useTicketText() {
  const { t, d } = useI18n()

  return {
    status: (status: TicketStatus) => t(`tickets.status.${status}`),
    date: (value?: string | null) => (value ? d(new Date(value.length === 10 ? `${value}T00:00:00` : value), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
    time: (value?: string | null) => (value ? d(new Date(value), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'),
    size: (bytes?: number | null) => (bytes ? (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`) : ''),
  }
}
