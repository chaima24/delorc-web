import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { languagesApi, type Language } from '@/api/central/languages'
import { translationsApi, type TextRow } from '@/api/central/translations'
import { i18n } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import LanguagesView from '@/views/central/translations/LanguagesView.vue'
import TextsView from '@/views/central/translations/TextsView.vue'

const language = (id: number, code: string, name: string, values: Partial<Language> = {}): Language => ({
  id, code, name, native_name: name, direction: 'ltr', locale: `${code}-DZ`,
  is_active: true, texts_done: 1, texts_missing: 1, percent_done: 50, created_at: `2026-11-0${id}T10:00:00+00:00`, ...values,
})
const languages = [language(1, 'fr', 'French'), language(2, 'en', 'English'), language(3, 'ar', 'Arabic', { direction: 'rtl', is_active: false })]
const summary = { total: 1, done: 1, missing: 2, check: 0, percent_done: 33 }
const allRow: TextRow = { key: 'auth.login.title', used_in: 'web', note: null, texts: { fr: 'Bon retour', en: null, ar: null } }
const englishRow: TextRow = { key: 'auth.login.title', used_in: 'web', note: null, reference: 'Bon retour', value: null, shown: 'Bon retour', state: 'missing' }

async function plugins(path: string, permissions: string[]) {
  vi.spyOn(useAuthStore(), 'can').mockImplementation((permission) => permissions.includes(permission))
  const page = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/translations', name: 'central-translations', component: page },
      { path: '/languages', name: 'central-languages', component: page },
    ],
  })
  await router.push(path)

  return [router, i18n]
}

async function mountTexts(path = '/translations', permissions = ['translations.show', 'translations.update', 'languages.show']) {
  vi.spyOn(languagesApi, 'list').mockResolvedValue(languages)
  vi.spyOn(translationsApi, 'list').mockImplementation(async (filters) => ({
    data: [filters.language ? englishRow : allRow],
    meta: { total: 1 },
    summary,
  }))
  const wrapper = mount(TextsView, { global: { plugins: await plugins(path, permissions) } })
  await flushPromises()

  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'en'
  vi.restoreAllMocks()
})

describe('the texts page', () => {
  it('opens on every language, read only', async () => {
    const wrapper = await mountTexts()

    expect(translationsApi.list).toHaveBeenCalledWith(expect.objectContaining({ language: undefined, sort: 'key' }), 1, 25)
    expect(wrapper.text()).toContain('Bon retour')
    expect(wrapper.text()).toContain('Missing only')
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('shows boxes for the chosen language, and saves them together', async () => {
    const save = vi.spyOn(translationsApi, 'save').mockResolvedValue({} as never)
    const wrapper = await mountTexts('/translations?language=en')

    expect(wrapper.find('textarea').attributes('placeholder')).toBe('Missing: shows “Bon retour”')

    await wrapper.find('textarea').setValue('Welcome back')
    expect(wrapper.text()).toContain('1 change(s)')

    await wrapper.findAll('button').find((button) => button.text() === 'Save texts')!.trigger('click')
    await flushPromises()

    expect(save).toHaveBeenCalledWith([{ language: 'en', key: 'auth.login.title', value: 'Welcome back' }])
    expect(wrapper.text()).not.toContain('1 change(s)')
  })

  it('shows a refused text on its own row and keeps what was typed', async () => {
    vi.spyOn(translationsApi, 'save').mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { message: 'x', errors: { 'texts.0.value': ['The text must contain {total}.'] } } },
    })
    const wrapper = await mountTexts('/translations?language=en')

    await wrapper.find('textarea').setValue('Welcome')
    await wrapper.findAll('button').find((button) => button.text() === 'Save texts')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('The text must contain {total}.')
    expect(wrapper.find('textarea').element.value).toBe('Welcome')
  })

  it('shows no box to someone who cannot edit', async () => {
    const wrapper = await mountTexts('/translations?language=en', ['translations.show', 'languages.show'])

    expect(wrapper.find('textarea').exists()).toBe(false)
  })
})

describe('the languages page', () => {
  async function mountLanguages() {
    vi.spyOn(languagesApi, 'list').mockResolvedValue(languages)
    const wrapper = mount(LanguagesView, { global: { plugins: await plugins('/languages', ['languages.show']) } })
    await flushPromises()

    return wrapper
  }
  const names = (wrapper: Awaited<ReturnType<typeof mountLanguages>>) => wrapper.findAll('tbody strong').map((name) => name.text())

  it('opens newest first and searches on the page', async () => {
    const wrapper = await mountLanguages()

    expect(names(wrapper)).toEqual(['Arabic', 'English', 'French'])

    await wrapper.find('input').setValue('fren')
    expect(names(wrapper)).toEqual(['French'])
  })

  it('sorts every column', async () => {
    const wrapper = await mountLanguages()

    await wrapper.findAll('th button')[0]!.trigger('click')
    expect(names(wrapper)).toEqual(['Arabic', 'English', 'French'])

    await wrapper.findAll('th button')[0]!.trigger('click')
    expect(names(wrapper)).toEqual(['French', 'English', 'Arabic'])
  })
})
