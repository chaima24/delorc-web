import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { countriesApi, placesApi, type Commune, type Country, type Region, type Wilaya } from '@/api/central/geography'
import { i18n } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import CountriesView from '@/views/central/geography/CountriesView.vue'
import PlacesView from '@/views/central/geography/PlacesView.vue'

const algeria: Country = {
  id: 1, code: 'DZ', name: 'Algeria', native_name: 'الجزائر', phone_code: '+213', is_active: true,
  regions_count: 4, wilayas_count: 69, communes_count: 1541, created_at: '2026-11-03T10:00:00+00:00',
}
const spain: Country = { ...algeria, id: 2, code: 'ES', name: 'Spain', native_name: 'España', is_active: false, regions_count: 0, wilayas_count: 0, communes_count: 0, created_at: '2026-11-07T10:00:00+00:00' }
const centre: Region = { id: 1, name: 'CENTRE', arabic_name: 'الوسط', wilayas_count: 13, created_at: algeria.created_at }
const alger: Wilaya = {
  id: 16, name: 'Alger', arabic_name: 'الجزائر', phone_code: '021', latitude: 36.776111, longitude: 3.058333,
  region: { id: 1, name: 'CENTRE' }, communes_count: 57, created_at: algeria.created_at,
}
const babElOued: Commune = {
  id: 1605, name: 'Bab El Oued', arabic_name: 'باب الوادي', post_code: '16008', latitude: 36.790703, longitude: 3.05,
  wilaya: { id: 16, name: 'Alger' }, created_at: algeria.created_at,
}

async function plugins(path: string, permissions: string[]) {
  vi.spyOn(useAuthStore(), 'can').mockImplementation((permission) => permissions.includes(permission))
  const page = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/geography', name: 'central-countries', component: page },
      { path: '/geography/:code', name: 'central-country', component: page },
    ],
  })
  await router.push(path)

  return [router, i18n]
}

beforeEach(() => {
  // The side panel asks the screen size.
  window.matchMedia = vi.fn<typeof window.matchMedia>()
    .mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList)
  setActivePinia(createPinia())
  i18n.global.locale.value = 'en'
  vi.restoreAllMocks()
})

describe('the countries page', () => {
  it('lists countries newest first, searches and sorts them on the page', async () => {
    vi.spyOn(countriesApi, 'list').mockResolvedValue([algeria, spain])
    const wrapper = mount(CountriesView, { global: { plugins: await plugins('/geography', ['geography.show']) } })
    await flushPromises()
    const names = () => wrapper.findAll('tbody strong').map((name) => name.text())

    expect(names()).toEqual(['Spain', 'Algeria'])
    expect(wrapper.text()).toContain('1,541')

    await wrapper.find('input').setValue('alg')
    expect(names()).toEqual(['Algeria'])
  })

  it('shows add and import only with the right permissions', async () => {
    vi.spyOn(countriesApi, 'list').mockResolvedValue([algeria])
    const wrapper = mount(CountriesView, { global: { plugins: await plugins('/geography', ['geography.show']) } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Add a country')
    expect(wrapper.text()).not.toContain('Import a country')
  })
})

describe('allWilayas', () => {
  it('asks page after page until it has every wilaya', async () => {
    const page = (count: number, from: number) => Array.from({ length: count }, (_, index) => ({ ...alger, id: from + index }))
    const list = vi.spyOn(placesApi, 'wilayas')
      .mockResolvedValueOnce({ data: page(100, 1), meta: { total: 150 } })
      .mockResolvedValueOnce({ data: page(50, 101), meta: { total: 150 } })

    expect(await placesApi.allWilayas('ES')).toHaveLength(150)
    expect(list).toHaveBeenLastCalledWith('ES', { sort: 'name' }, 2, 100)
  })
})

describe('a country page', () => {
  async function mountPlaces(path: string) {
    vi.spyOn(countriesApi, 'get').mockResolvedValue(algeria)
    vi.spyOn(placesApi, 'regions').mockResolvedValue([centre])
    vi.spyOn(placesApi, 'wilayas').mockResolvedValue({ data: [alger], meta: { total: 1 } })
    vi.spyOn(placesApi, 'communes').mockResolvedValue({ data: [babElOued], meta: { total: 1 } })
    const wrapper = mount(PlacesView, { global: { plugins: await plugins(path, ['geography.show', 'geography.update']) } })
    await flushPromises()

    return wrapper
  }

  it('opens on wilayas, newest first, with the tab counts', async () => {
    const wrapper = await mountPlaces('/geography/DZ')

    expect(placesApi.wilayas).toHaveBeenCalledWith('DZ', expect.objectContaining({ sort: '-created_at' }), 1, 25)
    expect(wrapper.text()).toContain('Communes 1,541')
    expect(wrapper.text()).toContain('Alger')
  })

  it('asks the API to sort communes, from the first page', async () => {
    const wrapper = await mountPlaces('/geography/DZ?level=communes&wilaya=16')

    expect(placesApi.communes).toHaveBeenLastCalledWith('DZ', expect.objectContaining({ wilaya: 16 }), 1, 25)

    await wrapper.findAll('th button')[2]!.trigger('click')
    await flushPromises()

    expect(placesApi.communes).toHaveBeenLastCalledWith('DZ', expect.objectContaining({ sort: 'post_code' }), 1, 25)
  })

  it('sends a moved wilaya with its new region', async () => {
    const update = vi.spyOn(placesApi, 'updateWilaya').mockResolvedValue(alger)
    const wrapper = await mountPlaces('/geography/DZ')

    await wrapper.find('tbody tr').trigger('click')
    expect(wrapper.text()).toContain('See its communes')
    expect(wrapper.text()).toContain('This wilaya has communes, so it cannot be deleted.')

    await wrapper.findAll('button').find((button) => button.text() === 'Edit')!.trigger('click')
    await wrapper.findAll('input').find((input) => input.attributes('type') === 'number')!.setValue('36.8')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(update).toHaveBeenCalledWith(16, expect.objectContaining({ region_id: 1, latitude: 36.8, longitude: 3.058333 }))
  })
})
