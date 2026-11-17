import { useI18n } from 'vue-i18n'
import type { EventStatus } from '@/api/tenant/events'

export const STATUS_TONE: Record<EventStatus, 'warning' | 'success' | 'danger' | 'neutral'> = { proposed: 'warning', validated: 'success', refused: 'danger', closed: 'neutral' }

/** '2026-12-12 08:30' → a Date in the browser's time (the API sends the lab's local time). */
const toDate = (value: string) => new Date(value.replace(' ', 'T'))

/** Dates, hours, money and states of an event, as the pages show them. */
export function useEventText() {
  const { t, d, n } = useI18n()
  const day = (value: string) => d(toDate(value), { day: 'numeric', month: 'short', year: 'numeric' })
  const time = (value: string) => value.slice(11, 16)

  return {
    day,
    /** Same day: « 28 nov. 2026, 09:00 → 16:00 »; several: « 12 déc. 2026, 08:30 → 13 déc. 2026, 18:00 ». */
    period: (start: string, end: string) => (start.slice(0, 10) === end.slice(0, 10)
      ? `${day(start)}, ${time(start)} → ${time(end)}`
      : `${day(start)}, ${time(start)} → ${day(end)}, ${time(end)}`),
    money: (value: number | null | undefined) => (value == null ? '—' : `${n(value, { maximumFractionDigits: 2 })} DA`),
    status: (status: EventStatus) => t(`events.status.${status}`),
    target: (type: string) => t(`events.target.${type}`),
  }
}
