import { ref } from 'vue'
import { rolesApi } from '@/api/tenant/roles'
import { fetchAllTeams } from '@/api/tenant/teams'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

const ACRONYMS = new Set(['vm', 'vp', 'kam', 'r'])

/** "regional_supervisor" → "Regional supervisor", "vm" → "VM". */
export function roleLabel(name?: string | null): string {
  if (!name) return '—'
  const words = name.split('_').map(word => (ACRONYMS.has(word) ? word.toUpperCase() : word))
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Roles for selects (teams join with the teams module), loaded once per page. */
export function useRolesAndTeams() {
  const roles = ref<{ value: number; label: string }[]>([])

  onMountedAndFocus(async () => {
    roles.value = (await rolesApi.list())
      .map(role => ({ value: role.id, label: roleLabel(role.name) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  return { roles }
}

/** Teams for selects and filters (cycles), loaded once per page. */
export function useTeamOptions() {
  const teams = ref<{ value: number; label: string }[]>([])

  onMountedAndFocus(async () => {
    teams.value = (await fetchAllTeams())
      .map(team => ({ value: team.id, label: team.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  return { teams }
}
