import type { TenantUser } from '@/api/tenant/users'

/**
 * Who reports to whom today, from the users' current manager links. Every manager of a person
 * counts the same: the person appears under each of them. People with no manager are at the
 * top; those who also manage nobody are listed apart. A link that would close a loop
 * (A → B → A, bad data) is left out so the tree always ends.
 */
export interface OrgTree {
  byId: Map<number, TenantUser>
  /** Current managers of each person. */
  managersOf: Map<number, number[]>
  /** People each manager has, directly. */
  childrenOf: Map<number, number[]>
  /** No manager, and people under them. */
  roots: number[]
  /** No manager and nobody to manage. */
  alone: number[]
}

/** Managers whose link has not ended (today, or starting later). */
function currentManagerIds(user: TenantUser, today: string): number[] {
  return (user.managers ?? [])
    .filter(manager => !manager.pivot?.end_date || manager.pivot.end_date.slice(0, 10) >= today)
    .map(manager => manager.id)
}

export function buildOrgTree(users: TenantUser[], sortName: (user: TenantUser) => string = user => user.full_name): OrgTree {
  const byId = new Map(users.map(user => [user.id, user]))
  const today = new Date().toISOString().slice(0, 10)
  const managersOf = new Map<number, number[]>()
  const childrenOf = new Map<number, number[]>()

  // Is `target` already under `from`? (then `from` cannot become target's report)
  const reaches = (from: number, target: number) => {
    const seen = new Set<number>()
    const queue = [from]
    while (queue.length) {
      const next = queue.pop()!
      if (next === target) return true
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(...(childrenOf.get(next) ?? []))
    }
    return false
  }

  for (const user of users) {
    for (const manager of new Set(currentManagerIds(user, today))) {
      if (manager === user.id || !byId.has(manager) || reaches(user.id, manager)) continue
      managersOf.set(user.id, [...(managersOf.get(user.id) ?? []), manager])
      childrenOf.set(manager, [...(childrenOf.get(manager) ?? []), user.id])
    }
  }

  const byName = (a: number, b: number) => sortName(byId.get(a)!).localeCompare(sortName(byId.get(b)!))
  for (const list of [...childrenOf.values(), ...managersOf.values()]) list.sort(byName)

  const top = users.filter(user => !managersOf.has(user.id)).map(user => user.id).sort(byName)
  return {
    byId,
    managersOf,
    childrenOf,
    roots: top.filter(id => childrenOf.has(id)),
    alone: top.filter(id => !childrenOf.has(id)),
  }
}

/** Every way up from the person to the top: each path runs top → … → one of their managers. */
export function chainsUp(tree: OrgTree, id: number): number[][] {
  const paths: number[][] = []
  const walk = (person: number, below: number[]) => {
    const managers = tree.managersOf.get(person) ?? []
    if (!managers.length) {
      if (below.length) paths.push(below)
      return
    }
    for (const manager of managers) {
      if (!below.includes(manager)) walk(manager, [manager, ...below])
    }
  }
  walk(id, [])
  return paths
}

/** Everyone under the person, all levels (each person once). */
export function peopleUnder(tree: OrgTree, id: number): Set<number> {
  const found = new Set<number>()
  const queue = [...(tree.childrenOf.get(id) ?? [])]
  while (queue.length) {
    const next = queue.pop()!
    if (found.has(next) || next === id) continue
    found.add(next)
    queue.push(...(tree.childrenOf.get(next) ?? []))
  }
  return found
}

/** Everyone above the person, all levels. */
export function peopleAbove(tree: OrgTree, id: number): Set<number> {
  const found = new Set<number>()
  const queue = [...(tree.managersOf.get(id) ?? [])]
  while (queue.length) {
    const next = queue.pop()!
    if (found.has(next) || next === id) continue
    found.add(next)
    queue.push(...(tree.managersOf.get(next) ?? []))
  }
  return found
}

/** People to show for a filter: those who match, plus everyone above them (so each match keeps its place). */
export function visibleFor(tree: OrgTree, matches: (user: TenantUser) => boolean): Set<number> {
  const visible = new Set<number>()
  for (const user of tree.byId.values()) {
    if (!matches(user)) continue
    visible.add(user.id)
    for (const id of peopleAbove(tree, user.id)) visible.add(id)
  }
  return visible
}
