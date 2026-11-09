import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { labApi, type Lab } from '@/api/tenant/lab'
import { currentLocale, i18n, nestTexts } from '@/plugins/i18n'
import { useLabStore } from '@/stores/lab'

const demo: Lab = {
  id: 'demo',
  name: 'Demo Pharma',
  logo_url: null,
  default_language: 'en',
  languages: [
    { code: 'fr', native_name: 'Français', direction: 'ltr' },
    { code: 'en', native_name: 'English', direction: 'ltr' },
    { code: 'ar', native_name: 'العربية', direction: 'rtl' },
  ],
}

describe('lab texts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    localStorage.clear()
    vi.spyOn(labApi, 'show').mockResolvedValue(demo)
    vi.spyOn(labApi, 'texts').mockImplementation(async (language) => ({
      language,
      direction: language === 'ar' ? 'rtl' : 'ltr',
      texts: { 'auth.login.title': `${language}: Bon retour` },
    }))
  })

  it('turns flat keys into the nested shape vue-i18n reads', () => {
    expect(nestTexts({ 'auth.login.title': 'Bon retour', 'auth.login.text': 'Connectez-vous' })).toEqual({
      auth: { login: { title: 'Bon retour', text: 'Connectez-vous' } },
    })
  })

  it("opens in the lab's default language on a first visit, with the lab's own texts", async () => {
    await useLabStore().load()

    expect(currentLocale()).toBe('en')
    expect(i18n.global.t('auth.login.title')).toBe('en: Bon retour')
    expect(labApi.texts).toHaveBeenCalledWith('en')
  })

  it('opens in the language this browser used last time, with its direction', async () => {
    localStorage.setItem('delorc.locale', 'ar')

    await useLabStore().load()

    expect(currentLocale()).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('shows the lab name above the sign-in title', async () => {
    vi.doMock('@/space', async (original) => ({ ...(await original<object>()), space: { isCentral: false, labId: 'demo' } }))
    vi.resetModules()
    const { default: AuthHeading } = await import('@/components/AuthHeading.vue')
    const { useLabStore: store } = await import('@/stores/lab')
    const { i18n: plugin } = await import('@/plugins/i18n')
    setActivePinia(createPinia())
    store().lab = demo

    const wrapper = mount(AuthHeading, { props: { title: 'Bon retour', text: '' }, global: { plugins: [plugin] } })

    expect(wrapper.text()).toContain('Demo Pharma')
    vi.doUnmock('@/space')
  })

  it('keeps the API message when this address is not a lab, or a suspended one', async () => {
    const answer = (status: number, message: string) => ({ isAxiosError: true, response: { status, data: { message } } })
    vi.spyOn(labApi, 'show').mockRejectedValueOnce(answer(404, "Ce laboratoire n'existe pas."))
    const store = useLabStore()

    await store.load()
    expect(store.unavailable).toEqual({ status: 404, message: "Ce laboratoire n'existe pas." })
    expect(labApi.texts).not.toHaveBeenCalled()

    vi.spyOn(labApi, 'show').mockRejectedValueOnce(new Error('Network Error')) // no answer: the form opens as usual
    await expect(useLabStore().load()).rejects.toThrow('Network Error')
  })
})
