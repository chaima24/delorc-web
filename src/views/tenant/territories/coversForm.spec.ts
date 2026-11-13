import { describe, expect, it } from 'vitest'
import type { RuleType } from '@/api/tenant/ruleTypes'
import { addPick, coversOf, picksFromCovers, removePick, scopeOf, toCoversPayload, zoneItems, type CoverPick } from './coversForm'

const types = [
  { id: 1, code: 'region', name: 'Région', parent_code: null, supports_zone_type: false },
  { id: 2, code: 'wilaya', name: 'Wilaya', parent_code: 'region', supports_zone_type: true, supports_sub_zone: true },
  { id: 3, code: 'commune', name: 'Commune', parent_code: 'wilaya', supports_zone_type: false },
  { id: 4, code: 'speciality', name: 'Spécialité', parent_code: null, supports_zone_type: false },
] as RuleType[]

const alger: CoverPick = { type: 'wilaya', id: 16, isSub: false, name: 'Alger', parentId: 1 }
const blida: CoverPick = { type: 'wilaya', id: 9, isSub: false, name: 'Blida', parentId: 1 }
const kouba: CoverPick = { type: 'commune', id: 501, isSub: false, name: 'Kouba', parentId: 16, parentName: 'Alger' }
const algerEst: CoverPick = { type: 'wilaya', id: 7, isSub: true, name: 'Alger Est', parentId: 16, parentName: 'Alger' }
const cardio: CoverPick = { type: 'speciality', id: 3, isSub: false, name: 'Cardiologie', parentId: null }

describe('covers form', () => {
  it('replaces a wilaya by one of its communes (most precise wins)', () => {
    const { picks, replaced } = addPick(types, [alger, blida, cardio], kouba)
    expect(picks).toEqual([blida, cardio, kouba])
    expect(replaced).toEqual([alger])
  })

  it('replaces communes and sub-zones by their whole wilaya', () => {
    const { picks, replaced } = addPick(types, [kouba, algerEst, blida], alger)
    expect(picks).toEqual([blida, alger])
    expect(replaced).toEqual([kouba, algerEst])
  })

  it('ignores a pick that is already there, and removes one', () => {
    expect(addPick(types, [alger], { ...alger }).picks).toEqual([alger])
    expect(removePick([alger, blida], alger)).toEqual([blida])
  })

  it('lists the wilayas that get a residence level: picked, or the wilaya of a commune / sub-zone', () => {
    expect(zoneItems(types, [blida, kouba, algerEst, cardio])).toEqual([{ id: 16, name: 'Alger' }, { id: 9, name: 'Blida' }])
  })

  it('builds the payload: picks by type, residence levels of touched wilayas only', () => {
    const rule = toCoversPayload(types, [kouba, algerEst, cardio], { 16: 'SR', 9: 'HR' })
    expect(rule.covers).toEqual([
      { type: 'commune', items: [{ id: 501 }] },
      { type: 'wilaya', items: [{ id: 7, is_sub_zone: true }] },
      { type: 'speciality', items: [{ id: 3 }] },
    ])
    expect(rule.zones).toEqual([{ wilaya_id: 16, type: 'SR' }])
    expect(coversOf([])).toEqual([])
  })

  it('reads a territory back, naming the wilaya of a commune from its zone', () => {
    const picks = picksFromCovers(
      [{ type: 'commune', name: 'Commune', linked: true, items: [{ id: 501, name: 'Kouba', is_sub_zone: false, parent_id: 16 }] }],
      [{ wilaya_id: 16, name: 'Alger', type: 'RE' }],
    )
    expect(picks).toEqual([kouba])
    const named = picksFromCovers([{ type: 'commune', name: 'Commune', linked: true, items: [{ id: 501, name: 'Kouba', is_sub_zone: false, parent_id: 16, parent_name: 'Alger' }] }])
    expect(named).toEqual([kouba])
  })

  // Alger (16) and Blida (9) are in region 1, Oran (31) in region 2.
  const wilayaRegion: Record<number, number> = { 16: 1, 9: 1, 31: 2 }
  const parentOf = (code: string, id: number) => (code === 'wilaya' ? wilayaRegion[id] : undefined)
  const centre: CoverPick = { type: 'region', id: 1, isSub: false, name: 'Centre', parentId: null }

  it('narrows a type to the parent items in play (none in play: all are offered)', () => {
    expect(scopeOf(types, [], 'commune', parentOf)?.ids).toEqual(new Set())
    expect(scopeOf(types, [cardio], 'wilaya', parentOf)?.parent.code).toBe('region')
    expect(scopeOf(types, [blida, cardio], 'commune', parentOf)?.ids).toEqual(new Set([9]))
    expect(scopeOf(types, [centre], 'wilaya', parentOf)?.ids).toEqual(new Set([1]))
    expect(scopeOf(types, [], 'region', parentOf)).toBeNull()
    expect(scopeOf(types, [], 'speciality', parentOf)).toBeNull()
  })

  it('keeps a replaced parent in play through the deeper pick (Kouba keeps Alger, and Alger its region)', () => {
    expect(scopeOf(types, [kouba], 'commune', parentOf)?.ids).toEqual(new Set([16]))
    expect(scopeOf(types, [kouba], 'wilaya', parentOf)?.ids).toEqual(new Set([1]))
    expect(scopeOf(types, [algerEst], 'commune', parentOf)?.ids).toEqual(new Set([16]))
  })

  it('works for any chain set up from central, from parent_code only', () => {
    const custom = [
      { id: 10, code: 'zone', name: 'Zone', parent_code: null },
      { id: 11, code: 'sector', name: 'Secteur', parent_code: 'zone' },
      { id: 12, code: 'block', name: 'Îlot', parent_code: 'sector' },
    ] as RuleType[]
    const north: CoverPick = { type: 'zone', id: 5, isSub: false, name: 'Nord', parentId: null }
    const block: CoverPick = { type: 'block', id: 70, isSub: false, name: 'Îlot 7', parentId: 40 }
    const sectorZone = (code: string, id: number) => (code === 'sector' && id === 40 ? 5 : undefined)
    expect(scopeOf(custom, [], 'sector', sectorZone)?.ids).toEqual(new Set())
    expect(scopeOf(custom, [north], 'sector', sectorZone)?.ids).toEqual(new Set([5]))
    expect(scopeOf(custom, [block], 'sector', sectorZone)?.ids).toEqual(new Set([5]))
    expect(scopeOf(custom, [block], 'block', sectorZone)?.ids).toEqual(new Set([40]))
  })
})
