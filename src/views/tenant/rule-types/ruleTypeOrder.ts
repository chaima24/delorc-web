import type { RuleType } from '@/api/tenant/ruleTypes'

export interface RuleTypeGroups {
  /** Types that nest (Région › Wilaya › Commune), each chain top-down. */
  chains: RuleType[][]
  /** Types with no parent and no child. */
  alone: RuleType[]
}

/** Splits the types into nesting chains and stand-alone types, from `parent_code` only. */
export function groupRuleTypes(types: RuleType[]): RuleTypeGroups {
  const codes = new Set(types.map((type) => type.code))
  const childrenOf = (code: string) => types.filter((type) => type.parent_code === code)
  const below = (type: RuleType, seen = new Set<string>()): RuleType[] => {
    seen.add(type.code)

    return childrenOf(type.code).filter((child) => !seen.has(child.code)).flatMap((child) => [child, ...below(child, seen)])
  }

  const roots = types.filter((type) => type.parent_code === null || !codes.has(type.parent_code))

  return {
    chains: roots.filter((root) => childrenOf(root.code).length).map((root) => [root, ...below(root)]),
    alone: roots.filter((root) => !childrenOf(root.code).length),
  }
}

/** The chain a type belongs to, or the type alone. */
export function chainOf(groups: RuleTypeGroups, type: RuleType): RuleType[] {
  return groups.chains.find((chain) => chain.some((item) => item.code === type.code)) ?? [type]
}
