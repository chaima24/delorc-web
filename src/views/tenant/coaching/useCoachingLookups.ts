import { computed, ref } from 'vue'
import { fetchCoachingTree, type CoachingFamily } from '@/api/tenant/coaching'
import { rolesApi, type Role } from '@/api/tenant/roles'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

/** The roles and the grid a program's form picks from, reloaded when the form opens and on coming back to the tab. */
export function useCoachingLookups() {
  const roles = ref<Role[]>([])
  const families = ref<CoachingFamily[]>([])
  onMountedAndFocus(async () => {
    const [roleRows, tree] = await Promise.all([rolesApi.list(), fetchCoachingTree()])
    roles.value = roleRows.filter(role => !role.is_super)
    families.value = tree
  })
  const roleOptions = computed(() => roles.value
    .map(role => ({ value: role.id, label: roleLabel(role.name) }))
    .sort((a, b) => a.label.localeCompare(b.label)))

  return { roleOptions, families }
}
