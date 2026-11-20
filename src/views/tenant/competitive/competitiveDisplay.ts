import { useI18n } from 'vue-i18n'
import type { CompetitiveLevel, CompetitiveList, CompetitiveStatus } from '@/api/tenant/competitive'

export const STATUS_TONE: Record<CompetitiveStatus, 'neutral' | 'info' | 'success'> = { draft: 'neutral', sent: 'info', processed: 'success' }

/** Dates, states, levels and list names of Veille concurrentielle, as the pages show them. */
export function useCompetitiveText() {
  const { t, d } = useI18n()
  const date = (value?: string | null) => (value ? d(new Date(value.length === 10 ? `${value}T00:00:00` : value), { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return {
    date,
    status: (status: CompetitiveStatus) => t(`competitive.status.${status}`),
    level: (level?: CompetitiveLevel | null) => (level ? t(`competitive.level.${level}`) : '—'),
    list: (list: CompetitiveList) => t(`competitive.lists.${list}`),
  }
}

/** Today as 'YYYY-MM-DD' (a note is never seen in the future). */
export function today(): string {
  const day = new Date()
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}
