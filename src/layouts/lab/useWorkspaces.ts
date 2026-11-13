import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { routeName, workspaces, type NavLink, type Workspace } from './navigation'

/** The workspaces this person may open, and the one matching the current page. */
export function useWorkspaces() {
  const route = useRoute()
  const auth = useAuthStore()

  const isVisible = (link: NavLink) => (!link.resource || auth.can(`${link.resource}.show`)) && (!link.permission || auth.can(link.permission)) && (!link.feature || auth.hasFeature(link.feature))

  const visibleWorkspaces = computed<Workspace[]>(() =>
    workspaces.map((ws) => ({ ...ws, links: ws.links.filter(isVisible) })).filter((ws) => ws.links.length > 0),
  )

  const isCurrent = (link: NavLink, current: string) => routeName(link) === current || !!link.matches?.includes(current)

  const activeWorkspace = computed(() => {
    const current = String(route.name ?? '')

    return visibleWorkspaces.value.find((ws) => ws.links.some((link) => isCurrent(link, current)))
  })

  /** The tab of the active workspace for the current page. */
  const activeLink = computed(() => activeWorkspace.value?.links.find((link) => isCurrent(link, String(route.name ?? ''))))

  /** First page of a workspace: where its rail icon points. */
  const workspaceHome = (ws: Workspace) => ws.links[0]!.to

  return { visibleWorkspaces, activeWorkspace, activeLink, workspaceHome }
}
