import { useI18n } from 'vue-i18n'
import type { PeriodStatus } from '@/api/central/labs'

type Tone = 'info' | 'success' | 'warning' | 'neutral'

const PERIOD_TONES: Record<NonNullable<PeriodStatus>, Tone> = { trial: 'info', paid: 'success', grace: 'warning', ended: 'neutral' }

/** Words shared by the lab pages. The API sends codes and `YYYY-MM-DD` days. */
export function useLabTexts() {
  const { t, d, n } = useI18n()

  /** Noon, so the day never moves in another time zone. */
  const day = (value: string | null) => (value ? d(new Date(`${value}T12:00:00`), { dateStyle: 'medium' }) : '—')
  const periodLabel = (status: PeriodStatus) => t(`central.labs.period.${status ?? 'none'}`)
  const periodTone = (status: PeriodStatus): Tone => (status ? PERIOD_TONES[status] : 'neutral')
  const statusLabel = (status: 'active' | 'suspended') => t(`central.labs.status.${status}`)
  const money = (amount: string, currency: string) => `${n(Number(amount))} ${currency}`
  /** "Demo Pharma" → "DP": shown when the lab has no logo. */
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join('')

  return { day, periodLabel, periodTone, statusLabel, money, initials }
}

/** `YYYY-MM-DD` of today plus `days`, in the viewer's time. */
export function dayFromToday(days: number, now = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** A `YYYY-MM-DD` day moved by some days and years: `shiftDay('2026-12-06', 1)` is `2026-12-07`. */
export function shiftDay(value: string, days: number, years = 0): string {
  const [year, month, date] = value.split('-').map(Number)

  return dayFromToday(0, new Date(year! + years, month! - 1, date! + days))
}
