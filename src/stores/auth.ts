import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi, type Session, type User } from '@/api/auth'
import { tokens } from '@/api/tokens'
import { setLocale } from '@/plugins/i18n'

/** The signed-in person, shared by the whole app. */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const twoFactorSetupRequired = ref(false)
  const isSignedIn = computed(() => user.value !== null)

  let loaded = false

  function startSession(session: Session): void {
    tokens.save(session)
    user.value = session.user
    twoFactorSetupRequired.value = session.two_factor_setup_required
    loaded = true
    setLocale(session.user.locale)
  }

  function endSession(): void {
    tokens.clear()
    user.value = null
    twoFactorSetupRequired.value = false
  }

  /** After a page reload: asks the API who the saved token belongs to. Runs once. */
  async function load(): Promise<void> {
    if (loaded) {
      return
    }
    loaded = true

    if (tokens.access) {
      user.value = await authApi.me().catch(() => null)
    }
  }

  /** A correct password either opens the session, or returns the second-factor challenge to answer. */
  async function login(email: string, password: string) {
    const answer = await authApi.login(email, password)

    if (answer.status === 'ok') {
      startSession(answer)
    }

    return answer
  }

  async function verifyTwoFactor(challenge: string, code: string): Promise<void> {
    startSession(await authApi.verifyTwoFactor(challenge, code))
  }

  async function setPassword(token: string, password: string, confirmation: string): Promise<void> {
    startSession(await authApi.setPassword(token, password, confirmation))
  }

  async function logout(): Promise<void> {
    await authApi.logout(tokens.refresh).catch(() => undefined)
    endSession()
  }

  return { user, twoFactorSetupRequired, isSignedIn, load, login, verifyTwoFactor, setPassword, logout, endSession }
})
