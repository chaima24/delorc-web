import { client } from '@/api/client'

/** Équipe › Frais (docs/api/expenses.md): one claim per working day of a person, approved by their manager. */

export const EXPENSE_TYPES = ['home', 'away'] as const
export type ExpenseType = (typeof EXPENSE_TYPES)[number]

export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

export type ExpenseZone = 'in' | 'out'

export interface ExpensePerson {
  id: number
  full_name: string
  roles?: string[]
  avatar?: { url?: string | null } | null
}

export interface ExpenseAttachment {
  id: number
  url?: string | null
  mime?: string | null
  path?: string | null
}

export interface ExpenseKmLine {
  typed: number
  paid: number
  max: number | null
  rate: number
  amount: number
}

/** How a day's amount is worked out, line by line (kept as it was once approved). */
export interface ExpenseAmounts {
  km_in: ExpenseKmLine
  km_out: ExpenseKmLine
  meals: { typed: number; max: number; paid: number; price: number; amount: number }
  night: { away: boolean; number: number | null; max: number | null; paid: boolean; price: number; amount: number }
  other: number
  total: number
  setting_id: number | null
}

export interface ExpenseTrip {
  id: number
  departure_commune: { id: number; name: string; wilaya_id: number } | null
  arrival_commune: { id: number; name: string; wilaya_id: number } | null
  expense_type: { id: number; name: string } | null
  km: number
  zone: ExpenseZone
}

export interface ExpenseCost {
  id: number
  expense_type: { id: number; name: string } | null
  description: string | null
  price: number
  receipt: ExpenseAttachment | null
}

/** Who a setting is for: a person, or a role and / or a team (all null = everyone). */
export interface ExpenseSettingRef {
  id: number
  max_night?: number | null
  start_date: string | null
  role: string | null
  team: string | null
  person: string | null
}

/** One day, as the side panel shows it. */
export interface ExpenseDay {
  id: number
  user_id: number
  status: ExpenseStatus
  date: string
  type: ExpenseType
  meals: number
  comment: string | null
  reason: string | null
  treated_at: string | null
  amount: number | null
  created_at: string | null
  user: ExpensePerson
  treated_by: ExpensePerson | null
  trips: ExpenseTrip[]
  costs: ExpenseCost[]
  attachments: ExpenseAttachment[]
  amounts: ExpenseAmounts
  setting: ExpenseSettingRef | null
  can: { approve: boolean; edit: boolean }
}

/** An activity of the month that takes working days (training, leave…). */
export interface ExpenseMonthActivity {
  id: number
  title: string
  kind: 'off' | 'non' | 'field'
  from: string
  to: string
}

/** One day as listed in a person's month. */
export interface ExpenseMonthDay {
  id: number
  date: string
  type: ExpenseType
  meals: number
  status: ExpenseStatus
  reason: string | null
  refused_by: string | null
  route: string[]
  km_typed: number
  km_paid: number
  other: number
  total: number
  night_paid: boolean
  meals_over: number
}

export interface ExpenseFigures {
  days: number
  km_paid: number
  nights: number
  nights_over: number
  total: number
  approved_amount: number
  waiting_amount: number
  counts: Record<ExpenseStatus, number>
}

export interface ExpenseMonth {
  user: ExpensePerson & { teams: string[]; managers: string[] }
  setting: ExpenseSettingRef | null
  activities: ExpenseMonthActivity[]
  days: ExpenseMonthDay[]
  figures: ExpenseFigures
  can_approve: boolean
}

export type ExpenseBoardRow = ExpenseFigures & { user: ExpensePerson }

export interface ExpenseBoard {
  rows: ExpenseBoardRow[]
  totals: {
    waiting_amount: number
    waiting_days: number
    waiting_people: number
    approved_amount: number
    approved_days: number
    km_paid: number
    nothing_sent: number
  }
}

export interface ExpenseTripInput {
  departure_commune_id: number
  arrival_commune_id: number
  expense_type_id: number
  km: number
  zone: ExpenseZone
}

export interface ExpenseCostInput {
  id?: number | null
  expense_type_id: number
  price: number
  description?: string | null
  /** New receipt for this line (replaces the old one). */
  receipt?: File | null
}

export interface ExpensePayload {
  user_id?: number | null
  date: string
  type: ExpenseType
  meals: number
  comment?: string | null
  trips: ExpenseTripInput[]
  costs: ExpenseCostInput[]
}

export type ExpenseDayInput = Omit<ExpensePayload, 'user_id'>

const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } }

/** A multipart body with nested keys (`trips[0][km]`), under `days[0]` when sending several days. */
function appendDay(form: FormData, day: ExpensePayload, prefix = ''): void {
  const put = (path: (string | number)[], value: unknown) => {
    if (value === undefined || value === null) return
    const nested = path.map(part => `[${part}]`).join('')
    form.append(prefix ? `${prefix}${nested}` : `${path[0]}${nested.slice(String(path[0]).length + 2)}`, value instanceof File ? value : String(value))
  }
  put(['user_id'], day.user_id)
  put(['date'], day.date)
  put(['type'], day.type)
  put(['meals'], day.meals)
  put(['comment'], day.comment ?? '')
  day.trips.forEach((trip, i) => Object.entries(trip).forEach(([name, value]) => put(['trips', i, name], value)))
  day.costs.forEach((cost, i) => Object.entries(cost).forEach(([name, value]) => put(['costs', i, name], value)))
}

/** The preview takes JSON: no files. */
const withoutFiles = <T extends ExpenseDayInput>(day: T) => ({ ...day, costs: day.costs.map(({ receipt: _receipt, ...cost }) => cost) })

export const fetchExpenseBoard = (params: { month: string; team_id?: number }) => data<ExpenseBoard>(client.get('/expenses/board', { params }))

export const fetchExpenseMonth = (params: { month: string; user_id?: number }) => data<ExpenseMonth>(client.get('/expenses/month', { params }))

export const fetchExpenseDay = (id: number) => data<ExpenseDay>(client.get(`/expenses/${id}`))

/** One day sent again whole; multipart for its receipts (`_method` lets Laravel read it as a PUT). */
export function updateExpenseDay(id: number, payload: ExpensePayload) {
  const form = new FormData()
  appendDay(form, payload)
  form.append('_method', 'PUT')

  return data<ExpenseDay>(client.post(`/expenses/${id}`, form, multipart))
}

export const deleteExpenseDay = (id: number) => client.delete(`/expenses/${id}`)

/** "Ajouter des frais": several days at once, one claim per day. */
export function createExpenseDays(userId: number, days: ExpenseDayInput[]) {
  const form = new FormData()
  form.append('user_id', String(userId))
  days.forEach((day, i) => appendDay(form, day, `days[${i}]`))

  return data<{ id: number; date: string }[]>(client.post('/expenses/days', form, multipart))
}

/** Amounts of the days being typed; nights are numbered across them in date order. */
export const previewExpenseDays = (userId: number, days: ExpenseDayInput[]) =>
  data<{ days: ExpenseAmounts[]; total: number }>(client.post('/expenses/days/preview', { user_id: userId, days: days.map(withoutFiles) }))

export const previewExpenseDay = (payload: ExpensePayload, expenseId?: number | null) =>
  data<ExpenseAmounts>(client.post('/expenses/preview', { ...withoutFiles(payload), expense_id: expenseId ?? undefined }))

/** In or out of the person's zone for each commune, from their territory on that date. */
export const fetchExpenseZones = (params: { user_id?: number | null; date: string; commune_ids: number[] }) =>
  data<Record<number, { zone: ExpenseZone; zone_type: 'RE' | 'SR' | 'HR' | null }>>(
    client.get('/expenses/zones', { params: { user_id: params.user_id ?? undefined, date: params.date, commune_ids: params.commune_ids } }),
  )

export const approveExpenseDay = (id: number) => data<ExpenseDay>(client.post(`/expenses/${id}/approve`))

export const refuseExpenseDay = (id: number, reason: string) => data<ExpenseDay>(client.post(`/expenses/${id}/refuse`, { reason }))

export const approveExpenseMonth = (userId: number, month: string) =>
  data<{ approved: number }>(client.post('/expenses/approve-month', { user_id: userId, month }))
