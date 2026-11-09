import { useI18n } from 'vue-i18n'
import type { Product, ProductPayload } from '@/api/tenant/products'

/** Form values: numbers typed as text, sent as numbers (empty = no value). */
export interface ProductForm {
  name: string
  brand_id: number | null
  therapeutic_area: string
  per_box: string
  description: string
  price: string
  vat: string
  distribution_price: string
  wholesale_price: string
  pharmacy_price: string
  discount_price: string
  strategic: boolean
  us_discountable: boolean
  ugs: number[]
}

/** The parts of a product, each edited on its own (full page) or as a step (Add). */
export type ProductPart = 'info' | 'prices' | 'orders'

export const PRICE_FIELDS = ['distribution_price', 'wholesale_price', 'pharmacy_price', 'discount_price'] as const

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))

export function toForm(product?: Product | null): ProductForm {
  return {
    name: product?.name ?? '',
    brand_id: product?.brand_id ?? null,
    therapeutic_area: product?.therapeutic_area ?? '',
    per_box: text(product?.per_box),
    description: product?.description ?? '',
    price: text(product?.price),
    vat: text(product?.vat),
    distribution_price: text(product?.distribution_price),
    wholesale_price: text(product?.wholesale_price),
    pharmacy_price: text(product?.pharmacy_price),
    discount_price: text(product?.discount_price),
    strategic: product?.strategic ?? false,
    us_discountable: product?.us_discountable ?? false,
    ugs: [...(product?.ugs ?? [])].map(Number).sort((a, b) => a - b),
  }
}

const number = (value: string | number | null) => {
  const typed = String(value ?? '').trim()
  return typed === '' ? null : Number(typed.replace(',', '.'))
}

/** The API fields of one part (or all of them). */
export function toPayload(form: ProductForm, parts: ProductPart[] = ['info', 'prices', 'orders']): ProductPayload {
  const payload: ProductPayload = {}
  if (parts.includes('info')) {
    Object.assign(payload, {
      name: form.name.trim(),
      brand_id: form.brand_id ?? undefined,
      therapeutic_area: form.therapeutic_area.trim() || null,
      per_box: number(form.per_box),
      description: form.description.trim() || null,
    })
  }
  if (parts.includes('prices')) {
    Object.assign(payload, { price: number(form.price), vat: number(form.vat) })
    for (const key of PRICE_FIELDS) payload[key] = number(form[key])
  }
  if (parts.includes('orders')) Object.assign(payload, { strategic: form.strategic, us_discountable: form.us_discountable, ugs: form.ugs })
  return payload
}

/** Required fields of a part, as field → message. */
export function checkPart(form: ProductForm, part: ProductPart, required: string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (part === 'info') {
    if (!form.name.trim()) errors.name = required
    if (!form.brand_id) errors.brand_id = required
  }
  return errors
}

/** Money and percentages in the viewer's language ("1 480,00"). */
export function useProductText() {
  const { t, n, d } = useI18n()
  const money = (value?: string | number | null) =>
    value === null || value === undefined || value === '' ? '—' : n(Number(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const percent = (value?: string | number | null) =>
    value === null || value === undefined || value === '' ? '—' : `${n(Number(value), { maximumFractionDigits: 2 })} %`
  const date = (value?: string | null) =>
    value ? d(new Date(`${value.slice(0, 10)}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const yesNo = (value?: boolean) => t(value ? 'products.yes' : 'products.no')

  return { money, percent, date, yesNo }
}
