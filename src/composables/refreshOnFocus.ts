import { getCurrentInstance, onBeforeUnmount, onMounted } from 'vue'

/**
 * Keeps the lists of a form fresh: brands, teams, types… picked in selects. They are asked again when the person
 * comes back to this tab, so what they (or a colleague) just added elsewhere is there without reloading the page.
 * Like a cache with a refresh on use: a list shared by several open components is asked once, not once each.
 *
 *   onMountedAndFocus(async () => { brands.value = await fetchAllBrands() })   // a form's own lists
 *   refreshOnFocus(refresh)                                                      // a list kept in a shared module
 */
const users = new Map<() => unknown, number>()
let last = 0

function onFocus(): void {
  // Some browsers fire focus twice in a row (window, then tab).
  if (Date.now() - last < 2000) return
  last = Date.now()
  for (const refresh of users.keys()) refresh()
}

/** Calls `refresh` each time the tab gets the focus back, while the calling component is on screen. */
export function refreshOnFocus(refresh: () => unknown): void {
  if (!getCurrentInstance()) return // called outside a component: nothing to tie the listener to
  if (!users.size) window.addEventListener('focus', onFocus)
  users.set(refresh, (users.get(refresh) ?? 0) + 1)

  onBeforeUnmount(() => {
    const left = (users.get(refresh) ?? 1) - 1
    if (left > 0) users.set(refresh, left)
    else users.delete(refresh)
    if (!users.size) window.removeEventListener('focus', onFocus)
  })
}

/** Loads when the component opens, and again each time the tab gets the focus back. */
export function onMountedAndFocus(load: () => unknown): void {
  onMounted(load)
  refreshOnFocus(load)
}
