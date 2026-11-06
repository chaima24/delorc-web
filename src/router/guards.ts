import type { Router } from 'vue-router'
import { onSessionLost } from '@/api/client'
import { space } from '@/space'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Opens without signing in. Every other page needs a session. */
    public?: boolean
    /** The permission this page needs, like `permission:` on an API route. */
    permission?: string
  }
}

/** Runs before each page opens, like the `auth` middleware in the API. */
export function installGuards(router: Router): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    await auth.load()

    if (!to.meta.public && !auth.isSignedIn) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (to.meta.permission && !auth.can(to.meta.permission)) {
      return { name: 'home' }
    }

    if (to.name === 'home' && space.isCentral && auth.can('users.show')) {
      return { name: 'central-users' }
    }
  })

  onSessionLost(() => {
    useAuthStore().endSession()
    router.push({ name: 'login' })
  })
}
