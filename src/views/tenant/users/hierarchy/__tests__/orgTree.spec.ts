import { describe, expect, it } from 'vitest'
import type { TenantUser } from '@/api/tenant/users'
import { buildOrgTree, chainsUp, peopleAbove, peopleUnder, visibleFor } from '../orgTree'

const person = (id: number, name: string, managers: { id: number; end?: string | null }[] = []): TenantUser => ({
  id,
  first_name: name,
  last_name: '',
  full_name: name,
  email: `${name}@lab.dz`,
  managers: managers.map(m => ({ id: m.id, full_name: '', role: null, is_active: true, pivot: { id: m.id, start_date: '2026-01-01', end_date: m.end ?? null } })),
}) as TenantUser

// Amel → Samir → Nadia → Karim, Lina. Hana reports to Samir AND Amel. Yacine: no manager, nobody to manage.
const users = [
  person(1, 'Amel'),
  person(2, 'Samir', [{ id: 1 }]),
  person(3, 'Nadia', [{ id: 2 }, { id: 9, end: '2025-01-01' }]),
  person(4, 'Karim', [{ id: 3 }]),
  person(5, 'Lina', [{ id: 3 }]),
  person(6, 'Yacine'),
  person(7, 'Hana', [{ id: 2 }, { id: 1 }]),
]

describe('buildOrgTree', () => {
  const tree = buildOrgTree(users)

  it('puts people under every current manager, all equal; ended links do not count', () => {
    expect(tree.roots).toEqual([1])
    expect(tree.childrenOf.get(1)).toEqual([7, 2])
    expect(tree.childrenOf.get(2)).toEqual([7, 3])
    expect(tree.managersOf.get(7)).toEqual([1, 2])
    expect(tree.managersOf.get(3)).toEqual([2])
  })

  it('lists people with no manager and nobody to manage apart', () => {
    expect(tree.alone).toEqual([6])
  })

  it('gives every way up, and everyone under and above (each once)', () => {
    expect(chainsUp(tree, 7)).toEqual([[1], [1, 2]])
    expect(chainsUp(tree, 4)).toEqual([[1, 2, 3]])
    expect(chainsUp(tree, 1)).toEqual([])
    expect([...peopleUnder(tree, 1)].sort()).toEqual([2, 3, 4, 5, 7])
    expect([...peopleAbove(tree, 4)].sort()).toEqual([1, 2, 3])
  })

  it('keeps a match and everyone above it when filtering', () => {
    expect([...visibleFor(tree, user => user.full_name === 'Karim')].sort()).toEqual([1, 2, 3, 4])
  })

  it('leaves out a link that would close a loop', () => {
    const looped = buildOrgTree([person(1, 'A', [{ id: 2 }]), person(2, 'B', [{ id: 1 }])])
    expect(chainsUp(looped, 1).length + chainsUp(looped, 2).length).toBe(1)
  })
})
