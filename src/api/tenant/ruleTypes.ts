import { client } from '@/api/client'

/** The building blocks of territories, read only in the lab: central sets them up (docs/api/rule-types.md). */
export interface RuleType {
  id: number
  name: string
  code: string
  /** The type it sits in (a commune is inside a wilaya), or null. */
  parent_code: string | null
  is_visible: boolean
  supports_sub_zone: boolean
  /** Résidence / Semi-résidence / Hors résidence per wilaya. */
  supports_zone_type: boolean
  main_table: string
  sub_zone_table: string | null
  /** How a professional reaches a choice (`commune.wilaya_id`). Null: not offered in territories. */
  hcp_path: string | null
  hcp_sub_path: string | null
  /** The kinds of professionals it applies to; null = all. */
  hcp_types: string[] | null
  /** How a person reaches a choice, to suggest who can work a territory. */
  user_path: string | null
  user_sub_path: string | null
  /** A person with nothing on the path still matches (a team with no specialities). */
  user_skip_empty: boolean
  choices_count: number
  sub_zones_count: number | null
  territories_count: number
  /** Panel only: the first territories using it. */
  territories?: RuleTypeTerritory[]
}

/** A territory using a type, with how many of its choices and sub-zones it picked. */
export interface RuleTypeTerritory {
  id: number
  name: string
  choices: number
  sub_zones: number
}

/** Every type, in chain order (Région › Wilaya › Commune, then the types on their own). */
export const fetchRuleTypes = () => client.get<{ data: RuleType[] }>('/rule-types').then((response) => response.data.data)

export const fetchRuleType = (id: number) => client.get<{ data: RuleType }>(`/rule-types/${id}`).then((response) => response.data.data)

/** A choice of a type for a territory's covers step: an item (`main:16`) or a wilaya's sub-zone (`sub:3`), with its parent. */
export interface RuleTypeOption {
  value: string
  id: number
  label: string
  is_sub_zone: boolean
  parent_id: number | null
  parent_label: string | null
}

export const fetchRuleTypeOptions = (id: number) => client.get<{ data: RuleTypeOption[] }>(`/rule-types/${id}/options`).then((response) => response.data.data)
