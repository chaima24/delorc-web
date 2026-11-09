import { describe, expect, it } from 'vitest'
import { nearLimit, percentOf, type UsageNumbers } from '@/api/central/usage'

const GB = 1024 ** 3
const numbers = (accounts: number, emails: number, storageGb: number): UsageNumbers => ({
  accounts: { value: accounts, limit: 10 },
  signed_in: { value: 3 },
  emails: { value: emails, limit: 1000 },
  storage_bytes: { value: storageGb * GB, limit_gb: 5 },
})

describe('usage limits', () => {
  it('works out how full a number is, with no percent for unlimited or none', () => {
    expect(percentOf(800, 1000)).toBe(80)
    expect(percentOf(12, null)).toBeNull()
    expect(percentOf(0, 0)).toBeNull()
  })

  it('is near a limit from 80% of any of them, storage counted in GB', () => {
    expect(nearLimit(numbers(7, 500, 1))).toBe(false)
    expect(nearLimit(numbers(8, 500, 1))).toBe(true)   // 8 of 10 accounts
    expect(nearLimit(numbers(2, 1200, 1))).toBe(true)  // over the email quota
    expect(nearLimit(numbers(2, 100, 4.5))).toBe(true) // 4.5 of 5 GB
  })
})
