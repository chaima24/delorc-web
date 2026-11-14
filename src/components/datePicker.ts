import { parseDate, type DateValue } from '@internationalized/date'

/** The API speaks 'YYYY-MM-DD'; Reka's calendars speak CalendarDate. */
export const toDateValue = (value?: string | null): DateValue | undefined => {
  if (!value) return undefined
  try {
    return parseDate(value.slice(0, 10))
  }
  catch {
    return undefined
  }
}
export const toIso = (value?: DateValue | null) => (value ? value.toString() : '')

/** Shared looks of DlDatePicker and DlDateRangePicker: the field (as DlInput) and the calendar. */
export const FIELD = 'flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-dl-paper px-3.5 text-start text-sm transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt disabled:cursor-not-allowed disabled:opacity-60'
export const POPUP = 'z-2100 rounded-2xl border border-dl-line bg-dl-paper p-3 text-dl-fg shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]'
export const NAV = 'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-dl-body hover:bg-dl-mist focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt'
export const HEAD_CELL = 'w-9 pb-1.5 text-center text-[11px] font-semibold uppercase text-dl-muted'
export const DAY = [
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[13px] outline-hidden',
  'hover:bg-dl-mist focus-visible:ring-2 focus-visible:ring-dl-cobalt',
  'data-[today]:font-extrabold data-[today]:underline data-[today]:underline-offset-4',
  'data-[outside-view]:text-dl-muted/50',
  'data-[disabled]:cursor-not-allowed data-[disabled]:text-dl-muted/40',
  'data-[highlighted]:bg-dl-line-soft',
  'data-[selected]:bg-dl-line-soft data-[selected]:rounded-none',
  'data-[selection-start]:rounded-s-lg data-[selection-start]:bg-dl-ink data-[selection-start]:text-dl-on-ink',
  'data-[selection-end]:rounded-e-lg data-[selection-end]:bg-dl-ink data-[selection-end]:text-dl-on-ink',
].join(' ')
