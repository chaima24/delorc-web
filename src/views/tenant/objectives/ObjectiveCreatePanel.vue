<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createObjective, type Objective, type ObjectiveNumbers } from '@/api/tenant/objectives'
import { rolesApi, type Role } from '@/api/tenant/roles'
import { fetchAllTeams, type Team } from '@/api/tenant/teams'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { emptyNumbers, nextMonthStart, numbersFor } from './objectiveDisplay'
import ObjectiveNumbersFields from './ObjectiveNumbersFields.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

// "Add objective": role, team (or all teams), from a date, and only the numbers the role needs.
// `preset` fills role/team in (from "People with no objective").
const props = defineProps<{ preset?: { roleId: number | null; teamId: number | null } | null }>()
const emit = defineEmits<{ created: [objective: Objective] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const ALL_TEAMS = 'all'
const roles = ref<Role[]>([])
const teams = ref<Team[]>([])
onMountedAndFocus(async () => {
  const [roleRows, teamRows] = await Promise.all([rolesApi.list(), fetchAllTeams()])
  roles.value = roleRows.filter(role => !role.is_super)
  teams.value = teamRows
})
const roleOptions = computed(() => roles.value
  .map(role => ({ value: role.id, label: roleLabel(role.name) }))
  .sort((a, b) => a.label.localeCompare(b.label)))
const teamOptions = computed(() => [
  { value: ALL_TEAMS, label: t('objectives.allTeams') },
  ...teams.value.map(team => ({ value: team.id, label: team.name })).sort((a, b) => a.label.localeCompare(b.label)),
])

const roleId = ref<number | null>(null)
const team = ref<number | string>(ALL_TEAMS)
const start = ref(nextMonthStart())
const values = ref<ObjectiveNumbers>(emptyNumbers())
const errors = ref<Record<string, string>>({})
const saving = ref(false)

watch(open, value => {
  if (!value) return
  roleId.value = props.preset?.roleId ?? null
  team.value = props.preset?.teamId ?? ALL_TEAMS
  start.value = nextMonthStart()
  values.value = emptyNumbers()
  errors.value = {}
}, { immediate: true })

const role = computed(() => roles.value.find(row => row.id === roleId.value))
const numbers = computed(() => numbersFor(role.value?.visits))
const visitsLine = computed(() => {
  const kinds = role.value?.visits ?? []
  return kinds.length
    ? t('objectives.add.visits', { role: roleLabel(role.value?.name), kinds: kinds.map(kind => t(`objectives.kinds.${kind}`)).join(', ') })
    : t('objectives.add.noVisits', { role: roleLabel(role.value?.name) })
})

async function save() {
  errors.value = {}
  if (!roleId.value) {
    errors.value = { role_id: t('users.add.required') }
    return
  }
  saving.value = true
  try {
    // Numbers the role doesn't need are sent as 0.
    const sent = Object.fromEntries(Object.entries(values.value).map(([key, value]) => [key, numbers.value.includes(key as keyof ObjectiveNumbers) ? value : 0]))
    const created = await createObjective({
      role_id: roleId.value,
      team_id: team.value === ALL_TEAMS ? null : Number(team.value),
      start_date: start.value,
      ...sent,
    })
    toast.success(t('objectives.add.done'))
    emit('created', created)
  }
  catch (error) {
    // The API's messages come translated.
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('objectives.add.title')" :description="t('objectives.add.description')">
    <form id="objective-create" class="flex flex-col gap-4" @submit.prevent="save">
      <DlCombobox v-model="roleId" :label="t('objectives.fields.role')" :options="roleOptions" :error="errors.role_id" />
      <DlCombobox v-model="team" :label="t('objectives.fields.team')" :options="teamOptions" :hint="t('objectives.add.teamHint')" :error="errors.team_id" />
      <DlInput v-model="start" type="date" :label="t('objectives.fields.from')" :error="errors.start_date" />
      <template v-if="role">
        <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ visitsLine }}</p>
        <ObjectiveNumbersFields v-model="values" :numbers="numbers" :errors="errors" />
      </template>
    </form>

    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="objective-create" variant="primary" class="ms-auto" :loading="saving">{{ t('objectives.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
