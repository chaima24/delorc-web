import type { Territory } from '@/api/tenant/territories'

/** Territories under their parent, depth-first by name; a parent outside the list makes a top one. */
export function treeRows(territories: Territory[]): { territory: Territory; depth: number }[] {
  const ids = new Set(territories.map(item => item.id))
  const byParent = new Map<number | null, Territory[]>()
  for (const item of territories) {
    const parent = item.parent_id != null && ids.has(item.parent_id) ? item.parent_id : null
    byParent.set(parent, [...(byParent.get(parent) ?? []), item])
  }
  const rows: { territory: Territory; depth: number }[] = []
  const seen = new Set<number>()
  const walk = (parent: number | null, depth: number) => {
    for (const item of [...(byParent.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      rows.push({ territory: item, depth })
      walk(item.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}
