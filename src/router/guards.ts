import type { Router } from 'vue-router'
import { onSessionLost } from '@/api/client'
import { space } from '@/space'
import { useAuthStore } from '@/stores/auth'
import { useLabStore } from '@/stores/lab'

declare module 'vue-router' {
  interface RouteMeta {
    /** Opens without signing in. Every other page needs a session. */
    public?: boolean
    /** The permission this page needs, like `permission:` on an API route. */
    permission?: string
  }
}

/** Where the console opens: the first page this person may see. */
const CENTRAL_PAGES = [
  ['labs.show', 'central-labs'],
  ['usage.show', 'central-usage'],
  ['users.show', 'central-users'],
  ['roles.show', 'central-roles'],
  ['activity-log.show', 'central-activity'],
  ['translations.show', 'central-translations'],
  ['languages.show', 'central-languages'],
  ['geography.show', 'central-countries'],
  ['plans.show', 'central-plans'],
  ['settings.show', 'central-settings'],
] as const

/** Runs before each page opens, like the `auth` middleware in the API. */
export function installGuards(router: Router): void {
  router.beforeEach(async (to) => {
    // On a lab address: no page opens, not even sign-in, until the API says this lab exists and is active.
    if (!space.isCentral) {
      const lab = useLabStore()
      await lab.load()
      if (lab.state !== 'ok') {
        return to.name === 'lab-unavailable' ? true : { name: 'lab-unavailable' }
      }
      if (to.name === 'lab-unavailable') {
        return { name: 'login' }
      }
    }

    const auth = useAuthStore()
    await auth.load()

    if (!to.meta.public && !auth.isSignedIn) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (to.meta.permission && !auth.can(to.meta.permission)) {
      return { name: 'home' }
    }

    if (to.name === 'home' && space.isCentral) {
      const first = CENTRAL_PAGES.find(([permission]) => auth.can(permission))
      if (first) return { name: first[1] }
    }
  })

  onSessionLost(() => {
    useAuthStore().endSession()
    router.push({ name: 'login' })
  })
}
