import { describe, expect, it } from 'vitest'
import type { RuleType } from '@/api/tenant/ruleTypes'
import { chainOf, groupRuleTypes } from './ruleTypeOrder'

const type = (code: string, parent_code: string | null = null) => ({ id: code.length, code, name: code, parent_code }) as RuleType

describe('groupRuleTypes', () => {
  const types = [type('region'), type('wilaya', 'region'), type('commune', 'wilaya'), type('segmentation'), type('speciality')]

  it('puts the places in one chain and the others alone', () => {
    const groups = groupRuleTypes(types)

    expect(groups.chains.map((chain) => chain.map((item) => item.code))).toEqual([['region', 'wilaya', 'commune']])
    expect(groups.alone.map((item) => item.code)).toEqual(['segmentation', 'speciality'])
    expect(chainOf(groups, types[2]!).length).toBe(3)
    expect(chainOf(groups, types[3]!)).toEqual([types[3]])
  })

  it('treats a type whose parent is missing as a root', () => {
    expect(groupRuleTypes([type('commune', 'wilaya')]).alone.map((item) => item.code)).toEqual(['commune'])
  })
})
