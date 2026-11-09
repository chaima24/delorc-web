import { client } from '@/api/client'
import type { Attachment } from '@/api/tenant/users'
import type { ListParams, Page } from '@/api/tenant/geography'

/** A product of the lab (docs/api/products.md). Money and VAT come as text: "850.00". */
export interface Product {
  id: number
  brand_id: number
  name: string
  description: string | null
  per_box: number | null
  therapeutic_area: string | null
  strategic: boolean
  us_discountable: boolean
  vat: string | null
  discount_price: string | null
  price: string | null
  distribution_price: string | null
  pharmacy_price: string | null
  wholesale_price: string | null
  created_at: string | null
  brand?: { id: number; name: string }
  photo?: Attachment | null
  /** Free units a rep may offer: [1, 2, 3]. */
  ugs?: number[]
  ug_options?: { id: number; ug: number }[]
}

export type ProductPayload = Partial<Pick<Product, 'brand_id' | 'name' | 'description' | 'therapeutic_area' | 'strategic' | 'us_discountable'>> & {
  per_box?: number | null
  vat?: number | null
  price?: number | null
  discount_price?: number | null
  distribution_price?: number | null
  pharmacy_price?: number | null
  wholesale_price?: number | null
  ugs?: number[]
}

const one = (request: Promise<{ data: { data: Product } }>) => request.then((response) => response.data.data)

/** The fields as a form, for the photo: booleans as 1/0, lists as `ugs[]`, empty values left out. */
function asForm(body: ProductPayload, photo: File): FormData {
  const form = new FormData()
  for (const [field, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) value.forEach((item) => form.append(`${field}[]`, String(item)))
    else form.append(field, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  form.append('photo', photo)

  return form
}

export const fetchProducts = (params?: ListParams) =>
  client.get<{ data: Product[]; meta: { total: number } }>('/products', { params })
    .then((response): Page<Product> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchProduct = (id: number) => one(client.get(`/products/${id}`))
export const fetchTherapeuticAreas = () => client.get<{ data: string[] }>('/products/therapeutic-areas').then((response) => response.data.data)
export const createProduct = (body: ProductPayload, photo: File | null = null) =>
  one(client.post('/products', photo ? asForm(body, photo) : body))
export const updateProduct = (id: number, body: ProductPayload) => one(client.put(`/products/${id}`, body))
export const deleteProduct = (id: number) => client.delete(`/products/${id}`)
export const changeProductPhoto = (id: number, photo: File) => {
  const form = new FormData()
  form.append('photo', photo)

  return one(client.post(`/products/${id}/photo`, form))
}
export const removeProductPhoto = (id: number) => one(client.delete(`/products/${id}/photo`))
