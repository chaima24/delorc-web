import { describe, expect, it } from 'vitest'
import { areaLevel, buildAreas } from '@/views/tenant/settings/access/accessCatalog'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

const catalog = { people: { users: ['show', 'create', 'update', 'delete', 'change-role'], roles: ['show', 'create', 'update', 'delete'] } }

describe('lab roles page', () => {
  it("groups the API's catalog into areas, with the usual actions as columns and the others apart", () => {
    const [people] = buildAreas(catalog)

    expect(people?.key).toBe('people')
    expect(people?.resources[0]).toEqual({
      key: 'users',
      main: { show: 'users.show', create: 'users.create', update: 'users.update', delete: 'users.delete' },
      extra: [{ action: 'change-role', id: 'users.change-role' }],
    })
  })

  it("works out an area's level from the role's permission names", () => {
    const [people] = buildAreas(catalog)

    expect(areaLevel(people!, new Set())).toBe('none')
    expect(areaLevel(people!, new Set(['users.show', 'roles.show']))).toBe('view')
    expect(areaLevel(people!, new Set(['users.show', 'users.update']))).toBe('some')
  })

  it('reads role names', () => {
    expect(roleLabel('regional_supervisor')).toBe('Regional supervisor')
    expect(roleLabel('vm')).toBe('VM')
  })
})
