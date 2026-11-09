import { useI18n } from 'vue-i18n'

/** Noon, so no time zone moves the day. */
export const dayOf = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`)

/** Y-m-d of `iso` + `days` calendar days. */
export function addDays(iso: string, days: number) {
  const date = dayOf(iso)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

export function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Same day and month in another year; 29 Feb becomes 28 Feb. */
export function inYear(iso: string, year: number) {
  const [, month = 1, day = 1] = iso.split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`
}

export const isWeekend = (iso: string, weekend: number[]) => weekend.includes(dayOf(iso).getDay())

export function useHolidayText() {
  const { d } = useI18n()
  return {
    /** "Sun 1 Nov" */
    short: (iso: string) => d(dayOf(iso), { weekday: 'short', day: 'numeric', month: 'short' }),
    /** "Sunday 1 November 2026" */
    long: (iso: string) => d(dayOf(iso), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    month: (iso: string) => d(dayOf(iso), { month: 'short' }),
    monthYear: (iso: string) => d(dayOf(iso), { month: 'long', year: 'numeric' }),
    day: (iso: string) => dayOf(iso).getDate(),
    /** "Friday – Saturday" */
    weekend: (days: number[]) => days.map(day => d(new Date(2026, 10, 1 + day, 12), { weekday: 'long' })).join(' – '),
  }
}
