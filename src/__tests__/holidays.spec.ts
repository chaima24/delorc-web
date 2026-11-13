import { describe, expect, it } from 'vitest'
import { inYear, isWeekend } from '@/views/tenant/holidays/holidayDisplay'

describe('holidays', () => {
  it('moves a holiday to another year, 29 February becoming 28', () => {
    expect(inYear('2026-07-05', 2027)).toBe('2027-07-05')
    expect(inYear('2028-02-29', 2027)).toBe('2027-02-28')
  })

  it("reads the lab's weekend (Carbon day numbers: 5 Friday, 6 Saturday)", () => {
    expect(isWeekend('2026-05-01', [5, 6])).toBe(true) // a Friday
    expect(isWeekend('2026-07-05', [5, 6])).toBe(false) // a Sunday
  })
})
