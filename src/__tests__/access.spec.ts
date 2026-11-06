import { describe, expect, it } from 'vitest'
import { areaLevel, toggle } from '@/views/central/roles/access'

const resources = { plans: ['show', 'create'], usage: ['show'] }

describe('areaLevel', () => {
  it('reads how much of an area a role has', () => {
    expect(areaLevel(resources, [])).toBe('none')
    expect(areaLevel(resources, ['plans.show', 'usage.show'])).toBe('view')
    expect(areaLevel(resources, ['plans.show', 'plans.create'])).toBe('some')
    expect(areaLevel(resources, ['plans.show', 'plans.create', 'usage.show'])).toBe('full')
  })
})

describe('toggle', () => {
  it('ticks View with any action', () => {
    expect(toggle([], 'plans.create', resources.plans).sort()).toEqual(['plans.create', 'plans.show'])
  })

  it('removes the whole resource with View', () => {
    expect(toggle(['plans.show', 'plans.create', 'usage.show'], 'plans.show', resources.plans)).toEqual(['usage.show'])
  })

  it('removes only the action otherwise', () => {
    expect(toggle(['plans.show', 'plans.create'], 'plans.create', resources.plans)).toEqual(['plans.show'])
  })
})
