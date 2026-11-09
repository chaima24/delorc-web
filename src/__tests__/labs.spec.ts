import { describe, expect, it } from 'vitest'
import { dayFromToday, shiftDay } from '@/views/central/labs/useLabTexts'

describe('lab period days', () => {
  it('moves a day across months and years', () => {
    expect(shiftDay('2026-12-06', 1)).toBe('2026-12-07')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('proposes a one-year period after the last one', () => {
    const start = shiftDay('2026-12-06', 1)

    expect(shiftDay(start, -1, 1)).toBe('2027-12-06')
  })

  it('counts from today in the viewer time', () => {
    const now = new Date(2026, 10, 8, 23, 30)

    expect(dayFromToday(0, now)).toBe('2026-11-08')
    expect(dayFromToday(30, now)).toBe('2026-12-08')
  })
})
