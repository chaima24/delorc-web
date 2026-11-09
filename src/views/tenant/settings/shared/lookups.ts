import { onMounted, ref } from 'vue'
import { rolesApi } from '@/api/tenant/roles'

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

  onMounted(async () => {
    roles.value = (await rolesApi.list())
      .map(role => ({ value: role.id, label: roleLabel(role.name) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  return { roles }
}
