import type { RuleType } from '@/api/tenant/ruleTypes'
import type { CoverBlockPayload, TerritoryCover, TerritoryCoversPayload, TerritoryZone, ZoneType } from '@/api/tenant/territories'

/** One picked item of a rule type (a wilaya, a commune, a sub-zone, a speciality…). */
export interface CoverPick {
  type: string
  id: number
  isSub: boolean
  name: string
  /** The item it sits in (a commune's wilaya, a sub-zone's wilaya). */
  parentId: number | null
  parentName?: string | null
}

export type Zones = Record<number, ZoneType | undefined>

const same = (a: CoverPick, b: CoverPick) => a.type === b.type && a.id === b.id && a.isSub === b.isSub

/** The type whose items a pick sits in: the parent type, or its own type for a sub-zone. */
function parentTypeOf(types: RuleType[], pick: Pick<CoverPick, 'type' | 'isSub'>): RuleType | undefined {
  const type = types.find(item => item.code === pick.type)
  if (!type) return undefined
  return pick.isSub ? type : types.find(item => item.code === type.parent_code)
}

/** Is `child` inside `parent` (a commune of a picked wilaya, a sub-zone of a picked wilaya)? */
function isInside(types: RuleType[], child: CoverPick, parent: CoverPick): boolean {
  return !parent.isSub && child.parentId === parent.id && parentTypeOf(types, child)?.code === parent.type
}

/**
 * Adds a pick, keeping the most precise one: a commune replaces its wilaya, a wilaya replaces its
 * communes and sub-zones. Returns the picks it replaced (to tell the user).
 */
export function addPick(types: RuleType[], picks: CoverPick[], pick: CoverPick): { picks: CoverPick[]; replaced: CoverPick[] } {
  if (picks.some(item => same(item, pick))) return { picks, replaced: [] }
  const replaced = picks.filter(item => isInside(types, pick, item) || isInside(types, item, pick))
  return { picks: [...picks.filter(item => !replaced.includes(item)), pick], replaced }
}

/** An item's parent id, read from its type's options (a wilaya's region). */
export type ParentOf = (code: string, id: number) => number | null | undefined

/**
 * The items of a type the picks are working in: picked ones, and the ones a deeper pick sits in
 * (Kouba keeps Alger in play after replacing it, and so Alger's region too).
 */
export function inPlay(types: RuleType[], picks: CoverPick[], code: string, parentOf: ParentOf, seen = new Set<string>()): Set<number> {
  const ids = new Set<number>()
  if (seen.has(code)) return ids
  seen.add(code)
  for (const pick of picks.filter(item => item.type === code)) {
    const id = pick.isSub ? pick.parentId : pick.id
    if (id != null) ids.add(id)
  }
  for (const child of types.filter(type => type.parent_code === code)) {
    for (const id of inPlay(types, picks, child.code, parentOf, seen)) {
      const parent = picks.find(pick => pick.type === child.code && !pick.isSub && pick.id === id)?.parentId ?? parentOf(child.code, id)
      if (parent != null) ids.add(parent)
    }
  }
  return ids
}

/**
 * The parent items a type's choices are narrowed to: once a wilaya is in play, the communes are
 * those of the wilayas in play; once a region is, the wilayas of the regions in play (the type's
 * parent_code / parent_key). Empty ids or null (no pickable parent): all its items are offered.
 * docs/api/territories.md
 */
export function scopeOf(types: RuleType[], picks: CoverPick[], code: string, parentOf: ParentOf): { parent: RuleType; ids: Set<number> } | null {
  const parent = types.find(type => type.code === types.find(item => item.code === code)?.parent_code)
  return parent ? { parent, ids: inPlay(types, picks, parent.code, parentOf) } : null
}

export function removePick(picks: CoverPick[], pick: CoverPick): CoverPick[] {
  return picks.filter(item => !same(item, pick))
}

/** The items that get a residence level (the zone-type rule type's items the picks touch). */
export function zoneItems(types: RuleType[], picks: CoverPick[]): { id: number; name: string }[] {
  const zoneType = types.find(type => type.supports_zone_type)
  if (!zoneType) return []
  const found = new Map<number, string>()
  for (const pick of picks) {
    if (pick.type === zoneType.code && !pick.isSub) found.set(pick.id, pick.name)
    else if (pick.parentId != null && parentTypeOf(types, pick)?.code === zoneType.code) found.set(pick.parentId, pick.parentName ?? found.get(pick.parentId) ?? `#${pick.parentId}`)
  }
  return [...found].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function picksFromCovers(covers: TerritoryCover[] = [], zones: TerritoryZone[] = []): CoverPick[] {
  const names = new Map(zones.map(zone => [zone.wilaya_id, zone.name]))
  return covers.flatMap(cover => cover.items.map(item => ({
    type: cover.type,
    id: item.id,
    isSub: item.is_sub_zone,
    name: item.name ?? `#${item.id}`,
    parentId: item.parent_id,
    parentName: item.parent_name ?? (item.parent_id != null ? names.get(item.parent_id) ?? null : null),
  })))
}

export function zonesFrom(zones: TerritoryZone[] = []): Zones {
  return Object.fromEntries(zones.map(zone => [zone.wilaya_id, zone.type]))
}

export function coversOf(picks: CoverPick[]): CoverBlockPayload[] {
  const blocks = new Map<string, CoverBlockPayload>()
  for (const pick of picks) {
    const block = blocks.get(pick.type) ?? { type: pick.type, items: [] }
    block.items.push(pick.isSub ? { id: pick.id, is_sub_zone: true } : { id: pick.id })
    blocks.set(pick.type, block)
  }
  return [...blocks.values()]
}

/** The payload's `covers` and `zones`: picks by type, and the residence level of the touched wilayas that have one. */
export function toCoversPayload(types: RuleType[], picks: CoverPick[], zones: Zones): TerritoryCoversPayload {
  return {
    covers: coversOf(picks),
    zones: zoneItems(types, picks).flatMap(item => (zones[item.id] ? [{ wilaya_id: item.id, type: zones[item.id]! }] : [])),
  }
}
