import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { studioApi } from '@/api/tenant/studio'
import { i18n } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import SettingsHubView from '@/views/tenant/settings/SettingsHubView.vue'
import type { User } from '@/api/auth'

async function mountHub(permissions: string[]) {
  setActivePinia(createPinia())
  useAuthStore().user = { is_super: false, permissions } as unknown as User
  const page = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['tenant-settings', 'tenant-roles', 'tenant-permissions'].map((name) => ({ path: `/${name}`, name, component: page })),
  })
  const wrapper = mount(SettingsHubView, { global: { plugins: [router, i18n] } })
  await flushPromises()

  return wrapper
}

describe('Studio home', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(studioApi, 'summary').mockResolvedValue({ roles: 11, users: 2 })
  })

  it('shows the cards the person may open, with their count', async () => {
    const wrapper = await mountHub(['roles.show'])

    expect(wrapper.findAll('a[href="/tenant-roles"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('11')
  })

  it('shows no card without the right', async () => {
    const wrapper = await mountHub([])

    expect(wrapper.find('a[href="/tenant-roles"]').exists()).toBe(false)
  })
})
