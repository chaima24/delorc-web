import { describe, expect, it } from 'vitest'
import type { Territory } from '@/api/tenant/territories'
import { treeRows } from './territoryTree'

const territory = (id: number, name: string, parent_id: number | null = null) => ({ id, name, parent_id, user_id: 1 }) as Territory

describe('territory tree', () => {
  it('puts territories under their parent, by name', () => {
    const rows = treeRows([territory(3, 'Oran'), territory(2, 'Alger Ouest', 1), territory(1, 'Centre'), territory(4, 'Alger Est', 1)])
    expect(rows.map(row => [row.territory.name, row.depth])).toEqual([['Centre', 0], ['Alger Est', 1], ['Alger Ouest', 1], ['Oran', 0]])
  })

  it('shows a territory whose parent is not in the list at the top', () => {
    expect(treeRows([territory(2, 'Alger Est', 99)]).map(row => row.depth)).toEqual([0])
  })
})
