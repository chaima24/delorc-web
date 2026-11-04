import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { authApi, type User } from '@/api/auth'
import { tokens } from '@/api/tokens'
import { installGuards } from '@/router/guards'

const page = { template: '<div />' }

function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: page, meta: { public: true } },
      { path: '/users', name: 'users', component: page },
    ],
  })
  installGuards(router)

  return router
}

describe('router guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('sends a person without a session to the sign-in page', async () => {
    const router = makeRouter()

    await router.push('/users')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/users')
  })

  it('opens the page after a reload when the saved token is valid', async () => {
    tokens.save({ access_token: 'token', refresh_token: 'refresh' })
    const me = vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, locale: 'fr' } as User)
    const router = makeRouter()

    await router.push('/users')
    await router.push('/login')
    await router.push('/users')

    expect(router.currentRoute.value.name).toBe('users')
    expect(me).toHaveBeenCalledOnce()
  })
})
