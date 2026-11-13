import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** Planning and validation rules (docs/api/rules.md). Each person follows at most one of each kind. */
export type RuleKind = 'planning-rules' | 'validation-rules'

/** Who follows a rule: the chosen people, or everyone with one of the roles and in one of the teams. */
export interface RuleWho {
  /** Empty when the rule goes to chosen people. */
  roles?: { id: number; name: string | null }[]
  teams?: { id: number; name: string | null }[]
  /** The active people following the rule now. */
  users?: { id: number; full_name: string }[]
  users_count?: number
}

/** Sent only when who follows the rule changes (leaving it out keeps the people). */
export interface RuleWhoPayload {
  roles: number[]
  teams: number[]
  users: number[]
}

interface RuleBase extends RuleWho {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_by?: { id: number; full_name: string } | null
  created_at: string | null
  updated_at?: string | null
}

/** A cycle can be planned from `days_before_start_open` days before it starts until `days_before_start_close` days before. */
export interface PlanningRule extends RuleBase {
  days_before_start_open: number
  days_before_start_close: number
}

/** A visit can be validated up to `duration_hours` hours after its planned time. */
export interface ValidationRule extends RuleBase {
  duration_hours: number
}

type BasePayload = Partial<RuleWhoPayload> & { name?: string; description?: string | null; is_active?: boolean }
export type PlanningRulePayload = BasePayload & { days_before_start_open?: number; days_before_start_close?: number }
export type ValidationRulePayload = BasePayload & { duration_hours?: number }

export interface RuleCoverage {
  /** Active people. */
  people: number
  /** Active people following a rule of this kind. */
  covered: number
  /** The first people without one. */
  uncovered: { id: number; full_name: string }[]
}

export interface RulePreview {
  /** Active people the rule would go to. */
  people: number
  /** Rules some of them follow today, and how many would leave each. */
  moving: { id: number; name: string; people: number }[]
}

function rulesApi<T, P>(kind: RuleKind) {
  const one = (request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

  return {
    list: (params?: ListParams) => client.get<{ data: T[]; meta: { total: number } }>(`/${kind}`, { params })
      .then((response): Page<T> => ({ items: response.data.data, total: response.data.meta.total })),
    show: (id: number) => one(client.get(`/${kind}/${id}`)),
    create: (body: P) => one(client.post(`/${kind}`, body)),
    update: (id: number, body: P) => one(client.put(`/${kind}/${id}`, body)),
    remove: (id: number) => client.delete(`/${kind}/${id}`),
    /** Every rule at once, for the pickers (a lab has a few). */
    all: async () => (await client.get<{ data: T[] }>(`/${kind}`, { params: { per_page: 100, sort: 'name' } })).data.data,
  }
}

export const planningRulesApi = rulesApi<PlanningRule, PlanningRulePayload>('planning-rules')
export const validationRulesApi = rulesApi<ValidationRule, ValidationRulePayload>('validation-rules')

export const fetchRuleCoverage = (kind: RuleKind) =>
  client.get<{ data: RuleCoverage }>(`/${kind}/coverage`).then((response) => response.data.data)

export const fetchRulePreview = (kind: RuleKind, who: RuleWhoPayload, ruleId?: number) =>
  client.get<{ data: RulePreview }>(`/${kind}/preview`, { params: { ...who, rule_id: ruleId } }).then((response) => response.data.data)
