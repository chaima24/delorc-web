import { client } from '@/api/client'
import type { LabRow } from '@/api/central/labs'

/** A number and the limit it had that month: null is unlimited, 0 is none. */
export interface Counted { value: number; limit: number | null }

/** The four numbers of one lab and month. */
export interface UsageNumbers {
  accounts: Counted
  signed_in: { value: number }
  emails: Counted
  storage_bytes: { value: number; limit_gb: number | null }
}

export type UsageRow = LabRow & UsageNumbers

export interface UsageOverview {
  /** The 1st of the month: "2026-11-01". */
  month: string
  /** Months that have numbers, newest first. */
  months: string[]
  measured_at: string | null
  /** Lab counts are today's whatever the month; revenue is the chosen month's. */
  totals: {
    labs_active: number
    labs_suspended: number
    labs_trial: number
    trials_ending_soon: number
    revenue: { currency: string; amount: string }[]
  }
  labs: UsageRow[]
}

export type UsageMonth = UsageNumbers & { month: string }

export const usageApi = {
  /** `month` as "2026-10"; this month when empty. */
  overview: (month?: string) => client.get<{ data: UsageOverview }>('/usage', { params: month ? { month } : {} }).then((response) => response.data.data),
  lab: (labId: string) => client.get<{ data: { months: UsageMonth[] } }>(`/labs/${labId}/usage`).then((response) => response.data.data.months),
}

const GB = 1024 ** 3

/** How full a number is, 0 to 100+; null when there is no limit to compare with. */
export function percentOf(value: number, limit: number | null): number | null {
  return limit === null || limit === 0 ? null : (value / limit) * 100
}

/** The four numbers as value / limit pairs in the same unit (storage in GB). */
export function meters(numbers: UsageNumbers): { key: 'accounts' | 'emails' | 'storage'; value: number; limit: number | null }[] {
  return [
    { key: 'accounts', value: numbers.accounts.value, limit: numbers.accounts.limit },
    { key: 'emails', value: numbers.emails.value, limit: numbers.emails.limit },
    { key: 'storage', value: numbers.storage_bytes.value / GB, limit: numbers.storage_bytes.limit_gb },
  ]
}

/** 80% or more of any limit. */
export const nearLimit = (numbers: UsageNumbers) => meters(numbers).some((meter) => (percentOf(meter.value, meter.limit) ?? 0) >= 80)
