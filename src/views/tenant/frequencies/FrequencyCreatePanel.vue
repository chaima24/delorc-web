<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FrequencyGrid } from '@/api/tenant/frequencies'
import { rolesApi, type Role } from '@/api/tenant/roles'
import { fetchAllTeams, type Team } from '@/api/tenant/teams'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { nextMonthStart } from '@/views/tenant/objectives/objectiveDisplay'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { type GridLine, type GridValues, sortLines, startingLines, valuesOf } from './frequencyDisplay'

// "New grid": role, team (or all teams), from a date, and what it starts with (empty lines for the
// kinds the role visits, or a copy of another grid). The grid is then filled on the page.
const props = defineProps<{ grids: FrequencyGrid[]; preset?: { roleId: number | null } | null }>()
const emit = defineEmits<{
  start: [draft: { role: { id: number; name: string; visits: string[] }; team: { id: number; name: string } | null; start_date: string; lines: GridLine[]; values: GridValues }]
}>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const ALL_TEAMS = 'all'
const EMPTY = 'empty'
const roles = ref<Role[]>([])
const teams = ref<Team[]>([])
onMounted(async () => {
  const [roleRows, teamRows] = await Promise.all([rolesApi.list(), fetchAllTeams()])
  roles.value = roleRows.filter(role => !role.is_super)
  teams.value = teamRows
})
const roleOptions = computed(() => roles.value.map(role => ({ value: role.id, label: roleLabel(role.name) })).sort((a, b) => a.label.localeCompare(b.label)))
const teamOptions = computed(() => [
  { value: ALL_TEAMS, label: t('objectives.allTeams') },
  ...teams.value.map(team => ({ value: team.id, label: team.name })).sort((a, b) => a.label.localeCompare(b.label)),
])
const copyOptions = computed(() => [
  { value: EMPTY, label: t('frequencies.add.empty') },
  ...props.grids.map(grid => ({ value: grid.key, label: `${roleLabel(grid.role?.name)} · ${grid.team?.name ?? t('objectives.allTeams')}` })),
])

const roleId = ref<number | null>(null)
const team = ref<number | string>(ALL_TEAMS)
const start = ref(nextMonthStart())
const copy = ref<string | number>(EMPTY)
const error = ref('')
watch(open, value => {
  if (!value) return
  roleId.value = props.preset?.roleId ?? null
  team.value = ALL_TEAMS
  start.value = nextMonthStart()
  copy.value = EMPTY
  error.value = ''
}, { immediate: true })

function next() {
  const role = roles.value.find(row => row.id === roleId.value)
  if (!role) {
    error.value = t('users.add.required')
    return
  }
  const source = props.grids.find(grid => grid.key === copy.value)
  const picked = team.value === ALL_TEAMS ? null : teams.value.find(row => row.id === Number(team.value))
  emit('start', {
    role: { id: role.id, name: role.name, visits: role.visits ?? [] },
    team: picked ? { id: picked.id, name: picked.name } : null,
    start_date: start.value,
    lines: source ? sortLines(source.lines) : startingLines(role.visits),
    values: source ? valuesOf(source.cells) : {},
  })
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('frequencies.add.title')" :description="t('frequencies.add.description')">
    <form id="frequency-create" class="flex flex-col gap-4" @submit.prevent="next">
      <DlCombobox v-model="roleId" :label="t('objectives.fields.role')" :options="roleOptions" :error="error" />
      <DlCombobox v-model="team" :label="t('objectives.fields.team')" :options="teamOptions" :hint="t('frequencies.add.teamHint')" />
      <DlInput v-model="start" type="date" :label="t('objectives.fields.from')" />
      <DlCombobox v-model="copy" :label="t('frequencies.add.startWith')" :options="copyOptions" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="frequency-create" variant="dark" class="ms-auto">{{ t('frequencies.add.next') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
