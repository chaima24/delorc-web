import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { authApi, type TwoFactorChallenge } from '@/api/auth'
import { i18n } from '@/plugins/i18n'
import LoginView from '@/views/auth/LoginView.vue'

function rejected(errors: Record<string, string[]>) {
  return { isAxiosError: true, response: { status: 422, data: { message: 'x', errors } } }
}

function challenge(method: TwoFactorChallenge['method']): TwoFactorChallenge {
  return { status: 'two_factor_required', method, challenge: 'abc', expires_in: 600 }
}

async function mountLogin() {
  const page = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/', name: 'home', component: page },
      { path: '/forgot-password', name: 'forgot-password', component: page },
    ],
  })
  await router.push('/login')

  return mount(LoginView, { global: { plugins: [router, i18n] } })
}

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('shows a wrong email or password as one general message, with no field marked', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(rejected({ email: ['E-mail ou mot de passe incorrect.'] }))
    const wrapper = await mountLogin()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('E-mail ou mot de passe incorrect.')
    expect(wrapper.find('[aria-invalid]').exists()).toBe(false)
  })

  it('offers a new code for email and SMS', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(challenge('email'))
    const wrapper = await mountLogin()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Envoyer un nouveau code')
  })

  it('offers no new code for the authenticator app', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(challenge('app'))
    const wrapper = await mountLogin()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Code de vérification')
    expect(wrapper.text()).not.toContain('Envoyer un nouveau code')
  })

  it('shows a wrong code under the code field', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(challenge('app'))
    vi.spyOn(authApi, 'verifyTwoFactor').mockRejectedValue(rejected({ code: ['Code incorrect.'] }))
    const wrapper = await mountLogin()

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[aria-invalid]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Code incorrect.')
  })

  it('goes back to the first step when the challenge expired', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(challenge('app'))
    vi.spyOn(authApi, 'verifyTwoFactor').mockRejectedValue(rejected({ challenge: ['Le délai est dépassé.'] }))
    const wrapper = await mountLogin()

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Bon retour')
    expect(wrapper.find('[role="alert"]').text()).toBe('Le délai est dépassé.')
  })
})
