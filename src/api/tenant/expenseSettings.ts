import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** Studio › Terrain › Paramètres de frais (docs/api/expenses.md): rates and caps for a person, or a role and / or a team. */

/** How a setting matched a person: their own, role + team, role, team, or everyone. */
export type ExpenseSettingMatch = 'user' | 'role_team' | 'role' | 'team' | 'everyone'

export interface ExpenseSetting {
  id: number
  role_id: number | null
  team_id: number | null
  user_id: number | null
  start_date: string | null
  end_date: string | null
  restitution_price_per_km_in: number | string | null
  restitution_price_per_km_out: number | string | null
  max_km_in: number | null
  max_km_out: number | null
  max_night: number | null
  price_per_night: number | string | null
  price_per_meal: number | string | null
  max_meals_per_night: number | null
  /** Expense days that use it: a used setting can't be deleted. */
  expenses_count?: number
  role?: { id: number; name: string } | null
  team?: { id: number; name: string } | null
  user?: { id: number; full_name: string } | null
  created_by?: { id: number; full_name: string } | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ExpenseSettingPayload {
  role_id?: number | null
  team_id?: number | null
  user_id?: number | null
  start_date?: string | null
  end_date?: string | null
  restitution_price_per_km_in?: number | null
  restitution_price_per_km_out?: number | null
  max_km_in?: number | null
  max_km_out?: number | null
  max_night?: number | null
  price_per_night?: number | null
  price_per_meal?: number | null
  max_meals_per_night?: number | null
}

const one = (request: Promise<{ data: { data: ExpenseSetting } }>) => request.then((response) => response.data.data)

export const fetchExpenseSettings = (params?: ListParams) =>
  client.get<{ data: ExpenseSetting[]; meta: { total: number } }>('/expense-settings', { params })
    .then((response): Page<ExpenseSetting> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchExpenseSetting = (id: number) => one(client.get(`/expense-settings/${id}`))
export const createExpenseSetting = (body: ExpenseSettingPayload) => one(client.post('/expense-settings', body))
export const updateExpenseSetting = (id: number, body: ExpenseSettingPayload) => one(client.put(`/expense-settings/${id}`, body))
export const deleteExpenseSetting = (id: number) => client.delete(`/expense-settings/${id}`)

/** The setting in force for a person on a date (most specific wins). */
export const resolveExpenseSetting = (userId: number, date: string) =>
  client.get<{ data: { setting: ExpenseSetting | null; match: ExpenseSettingMatch | null } }>('/expense-settings/resolve', { params: { user_id: userId, date } })
    .then((response) => response.data.data)

/** Active people it targets (`matching`) and those for whom it would win (`winning`). */
export function fetchExpenseSettingCoverage(params: { setting_id?: number; role_id?: number | null; team_id?: number | null; user_id?: number | null; start_date?: string | null; date?: string }) {
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value != null && value !== ''))
  return client.get<{ data: { matching: number; winning: number } }>('/expense-settings/coverage', { params: query }).then((response) => response.data.data)
}
