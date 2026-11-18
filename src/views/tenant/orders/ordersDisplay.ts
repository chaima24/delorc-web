import { useI18n } from 'vue-i18n'
import type { PackState } from '@/api/tenant/orders'

export const PACK_TONE: Record<PackState, 'success' | 'info' | 'neutral'> = { current: 'success', upcoming: 'info', ended: 'neutral', off: 'neutral' }

/** Dates, amounts and percentages of the orders setup, as the pages show them. */
export function useOrdersText() {
  const { t, d, n } = useI18n()
  const date = (value?: string | null) => (value ? d(new Date(`${value.slice(0, 10)}T00:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
  const amount = (value?: string | number | null) => (value == null || value === '' ? '—' : `${n(Number(value), { maximumFractionDigits: 0 })} DA`)
  const percent = (value?: string | number | null) => (value == null || value === '' ? '—' : `${n(Number(value), { maximumFractionDigits: 2 })} %`)

  return {
    date,
    amount,
    percent,
    period: (start: string, end: string) => `${date(start)} → ${date(end)}`,
    state: (state: PackState) => t(`orders.packs.state.${state}`),
    clientType: (type: string) => t(`orders.packCommandes.for.${type}`),
  }
}

/** The buyer kinds an order takes, and the suppliers (docs/api/orders.md). */
export const BUYER_TYPES = ['pharmacie', 'wholestore', 'distributor']
export const SUPPLIER_TYPES = ['wholestore', 'distributor']
/** The kind of pack commande a buyer may use. */
export const packKind = (type?: string | null) => (type === 'pharmacie' ? 'pharmacy' : 'wholesaler')

/** A 'YYYY-MM-DD' day, `days` before today. */
export function daysAgo(days: number): string {
  const day = new Date()
  day.setDate(day.getDate() - days)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}
