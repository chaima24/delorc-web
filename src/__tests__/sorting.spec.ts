import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { rolesApi, type Role } from '@/api/central/roles'
import { usersApi, type CentralUser } from '@/api/central/users'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { i18n } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import RolesView from '@/views/central/roles/RolesView.vue'
import UsersView from '@/views/central/users/UsersView.vue'

async function plugins() {
  vi.spyOn(useAuthStore(), 'can').mockReturnValue(false)
  const page = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/users', name: 'central-users', component: page },
      { path: '/roles', name: 'central-roles', component: page },
      { path: '/roles/:id/access', name: 'central-role-access', component: page },
    ],
  })
  await router.push('/users')

  return [router, i18n]
}

const role = (id: number, name: string, users_count: number, permissions: string[], is_super = false): Role =>
  ({ id, name, is_super, users_count, permissions, created_at: `2026-11-0${id}T10:00:00+00:00` })

const person: CentralUser = {
  id: 1, name: 'Karim Toumi', initials: 'KT', email: 'karim@delorc.test', phone: null, locale: 'fr', is_active: true,
  has_password: true, last_login_at: null, role: 'support', two_factor_method: 'none', created_at: '2026-11-06T10:00:00+00:00',
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'en'
  vi.restoreAllMocks()
})

describe('DlSortHeader', () => {
  function header(sort: string) {
    return mount(DlSortHeader, { props: { label: 'Name', column: 'name', modelValue: sort } })
  }

  it('sorts a new column, then reverses it', async () => {
    const other = header('role')
    await other.find('button').trigger('click')
    expect(other.emitted('update:modelValue')?.[0]).toEqual(['name'])

    const sorted = header('name')
    await sorted.find('button').trigger('click')
    expect(sorted.emitted('update:modelValue')?.[0]).toEqual(['-name'])

    const reversed = header('-name')
    await reversed.find('button').trigger('click')
    expect(reversed.emitted('update:modelValue')?.[0]).toEqual(['name'])
  })

  it('tells screen readers the direction', () => {
    expect(header('-name').find('th').attributes('aria-sort')).toBe('descending')
    expect(header('role').find('th').attributes('aria-sort')).toBe('none')
  })
})

describe('sorting the tables', () => {
  it('asks the API to sort people, from the first page', async () => {
    const list = vi.spyOn(usersApi, 'list').mockResolvedValue({ data: [person], meta: { total: 1 } })
    const wrapper = mount(UsersView, { global: { plugins: await plugins() } })
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: '-created_at' }), 1, 25)

    await wrapper.findAll('th button')[1]!.trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'role' }), 1, 25)
  })

  it('sorts roles on the page, with the owner above everyone for access', async () => {
    vi.spyOn(rolesApi, 'list').mockResolvedValue([
      role(1, 'owner', 1, [], true),
      role(2, 'support', 4, ['labs.show', 'labs.update']),
      role(3, 'billing', 9, ['plans.show']),
    ])
    vi.spyOn(rolesApi, 'catalog').mockResolvedValue({})
    const wrapper = mount(RolesView, { global: { plugins: await plugins() } })
    await flushPromises()
    const firstColumn = () => wrapper.findAll('tbody tr').map((row) => row.find('strong').text())
    const headers = wrapper.findAll('th button')

    expect(firstColumn()).toEqual(['Owner', 'Support', 'Billing'])

    await headers[0]!.trigger('click')
    expect(firstColumn()).toEqual(['Billing', 'Owner', 'Support'])

    await headers[1]!.trigger('click')
    await headers[1]!.trigger('click')
    expect(firstColumn()).toEqual(['Billing', 'Support', 'Owner'])

    await headers[2]!.trigger('click')
    await headers[2]!.trigger('click')
    expect(firstColumn()).toEqual(['Owner', 'Support', 'Billing'])

    await wrapper.find('input').setValue('bill')
    expect(firstColumn()).toEqual(['Billing'])

    await wrapper.find('input').setValue('nothing')
    expect(wrapper.text()).toContain('No role found')
  })
})
