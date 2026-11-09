import { client } from '@/api/client'

/** A limit is a number (null = unlimited); a switch is true or false. */
export type FeatureValue = number | boolean | null

export interface Feature {
  key: string
  type: 'limit' | 'switch'
  default: number | boolean
}

export interface Plan {
  id: number
  name: string
  description: string | null
  /** A string, so no decimals are lost: "45000.00". */
  monthly_price: string
  currency: string
  is_active: boolean
  labs_count: number
  /** Every catalog feature, keyed by its key ("users.max"). */
  values: Record<string, FeatureValue>
  /** The features shown from their default, because the plan has no value yet. */
  defaults: string[]
  created_at: string
}

export interface PlanDetails {
  name: string
  description: string | null
  monthly_price: number
  currency: string
}

export type NewPlan = PlanDetails & { start_from: number | null }
export type PlanChanges = Partial<PlanDetails & Pick<Plan, 'is_active'>>

export interface ValueToSave {
  plan_id: number
  feature: string
  value: FeatureValue
}

const one = (response: { data: { data: Plan } }) => response.data.data

export const plansApi = {
  features: () => client.get<{ data: Feature[] }>('/features').then((response) => response.data.data),
  list: () => client.get<{ data: Plan[] }>('/plans').then((response) => response.data.data),
  create: (plan: NewPlan) => client.post('/plans', plan).then(one),
  update: (id: number, changes: PlanChanges) => client.put(`/plans/${id}`, changes).then(one),
  saveValues: (values: ValueToSave[]) => client.put<{ data: Plan[] }>('/plans/values', { values }).then((response) => response.data.data),
  remove: (id: number) => client.delete(`/plans/${id}`),
}
