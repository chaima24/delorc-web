import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi, type LabAccess, type Session, type User } from '@/api/auth'
import { tokens } from '@/api/tokens'
import { setLocale } from '@/plugins/i18n'

/** The signed-in person, shared by the whole app. */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const twoFactorSetupRequired = ref(false)
  const isSignedIn = computed(() => user.value !== null)

  /** Hides what the person may not do. The API checks again: this is only for the screen. */
  function can(permission: string): boolean {
    return !!user.value && (user.value.is_super || user.value.permissions.includes(permission))
  }

  /**
   * On a lab: what its plan gives today (`auth/me` → `lab`), asked once. Hides the pages of an optional product the
   * lab doesn't have (`module.expenses`…); the API answers 404 for them anyway.
   */
  const labAccess = ref<LabAccess | null>(null)
  let accessRequest: Promise<LabAccess | null> | null = null
  function loadLabAccess(): Promise<LabAccess | null> {
    accessRequest ??= authApi.labAccess().then((access) => (labAccess.value = access)).catch(() => null)
    return accessRequest
  }
  const hasFeature = (key: string): boolean => !!labAccess.value?.features[key]

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
    labAccess.value = null
    accessRequest = null
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

  /** Reads the person again, after a change made outside this tab (an email confirmed from its link). */
  async function refreshUser(): Promise<User | null> {
    return authApi.me().catch(() => user.value)
  }

  async function logout(): Promise<void> {
    await authApi.logout(tokens.refresh).catch(() => undefined)
    endSession()
  }

  return { user, twoFactorSetupRequired, isSignedIn, can, labAccess, loadLabAccess, hasFeature, load, login, verifyTwoFactor, setPassword, logout, endSession, startSession, refreshUser }
})
