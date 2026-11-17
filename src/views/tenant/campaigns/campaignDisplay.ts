import { useI18n } from 'vue-i18n'
import type { CampaignState } from '@/api/tenant/campaigns'

export const STATE_TONE: Record<CampaignState, 'success' | 'info' | 'neutral'> = { current: 'success', upcoming: 'info', ended: 'neutral' }

const DAY = 86_400_000
const toDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`)

/** Where today sits in a campaign: day 18 of 92, 74 days left, 19.5 % of the bar. */
export function campaignProgress(start: string, end: string, today = new Date()) {
  const total = Math.round((toDate(end).getTime() - toDate(start).getTime()) / DAY) + 1
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const day = Math.min(total, Math.max(0, Math.round((midnight.getTime() - toDate(start).getTime()) / DAY) + 1))

  return { day, total, left: total - day, percent: total ? (day / total) * 100 : 0 }
}

/** Dates and states of a campaign, as the pages show them. */
export function useCampaignText() {
  const { t, d } = useI18n()
  const date = (value?: string | null) => (value ? d(toDate(value), { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return {
    date,
    period: (start: string, end: string) => `${date(start)} → ${date(end)}`,
    state: (state: CampaignState) => t(`campaigns.state.${state}`),
  }
}

/** Two letters for a brand's tile (brands have no colour): "Cardiozen" → "CA". */
export const brandInitials = (name: string) => name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase()
