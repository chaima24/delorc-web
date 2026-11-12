<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createUser, fetchUserSuggestions, type TenantUser, type UserSuggestions } from '@/api/tenant/users'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSteps from '@/components/DlSteps.vue'
import { useToast } from '@/composables/useToast'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import RulePicker from './RulePicker.vue'
import { loadCommunes, useUserLookups } from './useUserLookups'
import { today } from './userDisplay'
import { useAuthStore } from '@/stores/auth'

// "Add a user" in 3 steps: person · role, team and manager · rules and cycle. Rules and manager are pre-filled
// from colleagues (same role and team). The territory is optional and starts with the teams. The first cycle is
// optional, ticked for field roles; made only when the role + team has an objective (docs/api/cycles.md).
const emit = defineEmits<{ created: [user: TenantUser] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const lookups = useUserLookups()

/** Last day of the quarter `date` is in: cycles usually run by quarter. */
function quarterEnd(date: string) {
  const [year = 0, month = 1] = date.split('-').map(Number)
  const end = new Date(Date.UTC(year, Math.floor((month - 1) / 3) * 3 + 3, 0))
  return end.toISOString().slice(0, 10)
}

function blank() {
  const start = today()
  return {
    first_name: '', last_name: '', email: '', phone: '', address: '',
    wilaya_id: null as number | null, commune_id: null as number | null, language_id: null as number | null,
    avatar: null as File | null,
    role: null as string | null, team_id: null as number | null, second_team_id: null as number | null,
    manager_id: null as number | null, territory_id: null as number | null,
    start_date: today(), send_access: true,
    planning_rule_id: null as number | null, validation_rule_id: null as number | null,
    first_cycle: false, cycle_start: start, cycle_end: quarterEnd(start),
  }
}
const form = reactive(blank())
const step = ref(0)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const showSecondTeam = ref(false)

watch(open, value => {
  if (!value) return
  Object.assign(form, blank(), { language_id: defaultLanguage() })
  step.value = 0
  errors.value = {}
  showSecondTeam.value = false
  suggestions.value = null
  touched.clear()
})

// A field role gets a first cycle by default; the start date also moves the cycle, until it is changed by hand.
watch(() => form.role, role => { form.first_cycle = !!role && lookups.fieldRoles.value.includes(role) })
watch(() => form.start_date, (value, previous) => {
  if (!value) return
  if (form.cycle_start === previous) form.cycle_start = value
  if (form.cycle_end === quarterEnd(previous ?? value)) form.cycle_end = quarterEnd(value)
})

// Default language: French when the lab has it (labs usually work in French), else the first one.
const defaultLanguage = () => lookups.languages.value.find(language => language.code === 'fr')?.id ?? lookups.languages.value[0]?.id ?? null
watch(lookups.languages, () => {
  if (!form.language_id) form.language_id = defaultLanguage()
}, { immediate: true })
const languageItems = computed(() => lookups.languages.value.map(language => ({ value: String(language.id), label: language.native_name || language.name })))
const languageModel = computed({
  get: () => String(form.language_id ?? ''),
  set: value => { form.language_id = Number(value) },
})

const communes = ref<{ value: number; label: string }[]>([])
watch(() => form.wilaya_id, async id => {
  form.commune_id = null
  communes.value = id ? await loadCommunes(id) : []
})

const photoUrl = computed(() => (form.avatar ? URL.createObjectURL(form.avatar) : null))
function pickPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) form.avatar = file
}

// Suggestions from colleagues. A field the admin changed is never overwritten.
const suggestions = ref<UserSuggestions | null>(null)
const touched = new Set<string>()
function touch(field: string) { touched.add(field) }
watch(() => [form.role, form.team_id] as const, async ([role, team]) => {
  if (!role) return
  try {
    const result = await fetchUserSuggestions({ role, team_id: team ?? undefined })
    if (form.role !== role || form.team_id !== team) return
    suggestions.value = result
    if (!touched.has('manager') && result.manager) form.manager_id = result.manager.id
    if (!touched.has('planning')) form.planning_rule_id = result.planning_rule?.id ?? null
    if (!touched.has('validation')) form.validation_rule_id = result.validation_rule?.id ?? null
  }
  catch {
    suggestions.value = null
  }
})
const teamName = computed(() => lookups.teams.value.find(team => team.value === form.team_id)?.label ?? '')
function why(kind: 'planning_rule' | 'validation_rule') {
  const s = suggestions.value
  const suggestion = s?.[kind]
  const chosen = kind === 'planning_rule' ? form.planning_rule_id : form.validation_rule_id
  if (!s || !suggestion || suggestion.id !== chosen || !s.peers) return null
  const role = roleLabel(form.role)
  return s.scope === 'role_team'
    ? t('users.add.whyTeam', { count: n(suggestion.count), total: n(s.peers), role, team: teamName.value }, s.peers)
    : t('users.add.whyRole', { count: n(suggestion.count), total: n(s.peers), role }, s.peers)
}

const managerHint = computed(() => {
  const manager = suggestions.value?.manager
  return manager && manager.id === form.manager_id ? t('users.add.managerSuggested', { team: teamName.value || roleLabel(form.role) }) : undefined
})

const steps = computed(() => [t('users.add.steps.person'), t('users.add.steps.place'), t('users.add.steps.rules')])
const LAST = 2

/** Fields of each step, to send the API's errors back to the right step. */
const STEP_FIELDS: string[][] = [
  ['first_name', 'last_name', 'email', 'phone', 'address', 'commune_id', 'language_id', 'avatar'],
  ['role', 'teams', 'managers', 'territory', 'start_date'],
  ['planning_rule_id', 'validation_rule_id', 'cycle_start', 'cycle_end'],
]
const required = (value: unknown) => (value === null || value === '' ? t('users.add.required') : null)
function check(index: number): boolean {
  const found: Record<string, string> = {}
  const need = (key: string, value: unknown) => { const error = required(value); if (error) found[key] = error }
  if (index === 0) {
    need('first_name', form.first_name.trim()); need('last_name', form.last_name.trim()); need('email', form.email.trim())
    need('phone', form.phone.trim()); need('commune_id', form.commune_id); need('language_id', form.language_id)
    if (form.phone && !/^\d{10}$/.test(form.phone.replace(/\s/g, ''))) found.phone = t('users.add.phoneFormat')
  }
  if (index === 1) { need('role', form.role); need('teams', form.team_id); need('start_date', form.start_date) }
  if (index === 2 && form.first_cycle) {
    need('cycle_start', form.cycle_start); need('cycle_end', form.cycle_end)
    if (form.cycle_start && form.cycle_end && form.cycle_end < form.cycle_start) found.cycle_end = t('users.add.cycleOrder')
  }
  errors.value = found
  return !Object.keys(found).length
}
function next() {
  if (check(step.value)) step.value++
}

async function save() {
  if (!check(LAST)) return
  saving.value = true
  try {
    const teams = [form.team_id, form.second_team_id].filter((id, i, all): id is number => !!id && all.indexOf(id) === i)
    const user = await createUser({
      user: {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(),
        phone: form.phone.replace(/\s/g, ''), address: form.address.trim() || null,
        commune_id: form.commune_id, language_id: form.language_id, avatar: form.avatar,
      },
      role: form.role!,
      teams: teams.map((id, i) => ({ id, start_date: form.start_date, is_primary: i === 0 })),
      send_access: form.send_access,
      managers: form.manager_id ? [{ id: form.manager_id, start_date: form.start_date }] : [],
      territory: form.territory_id ? { id: form.territory_id, start_date: form.start_date } : null,
      planning_rule_id: form.planning_rule_id,
      validation_rule_id: form.validation_rule_id,
      cycle: form.first_cycle ? { start_date: form.cycle_start, end_date: form.cycle_end } : null,
    })
    toast.success(form.send_access ? t('users.add.createdInvited', { email: user.email }) : t('users.add.created'))
    // No objective for the role + team: added without a cycle, and told why.
    if (user.cycle_skipped) toast.error(t('users.add.cycleSkipped'))
    emit('created', user)
  }
  catch (error) {
    // "user.email" → "email", "teams.0.id" → "teams", "cycle.end_date" → "cycle_end"
    const found: Record<string, string> = {}
    for (const [key, message] of Object.entries(fieldErrors(error))) {
      const field = key.startsWith('user.') ? key.slice(5) : key.startsWith('cycle.') ? `cycle_${key.slice(6, -5)}` : key.split('.')[0]!
      found[field] ??= message
    }
    if (!Object.keys(found).length) {
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return
    }
    errors.value = found
    const first = STEP_FIELDS.findIndex(fields => fields.some(field => field in found))
    if (first >= 0) step.value = first
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('users.add.title')">
    <div class="flex flex-col gap-4">
      <DlSteps :steps="steps" :current="step" />

      <!-- 1 · Person -->
      <form v-if="step === 0" id="user-add" class="flex flex-col gap-3.5" novalidate @submit.prevent="next">
        <label class="flex cursor-pointer items-center gap-3">
          <DlAvatar :name="`${form.first_name} ${form.last_name}`.trim() || '+'" :src="photoUrl" size="lg" tone="neutral" />
          <span class="text-xs text-dl-muted">{{ t('users.add.photoHint') }}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="pickPhoto">
        </label>
        <p v-if="errors.avatar" class="-mt-2 text-xs text-dl-rejected">{{ errors.avatar }}</p>
        <div class="flex flex-col gap-3.5">
          <DlInput v-model="form.first_name" :label="t('users.fields.firstName')" :error="errors.first_name" autocomplete="off" />
          <DlInput v-model="form.last_name" :label="t('users.fields.lastName')" :error="errors.last_name" autocomplete="off" />
        </div>
        <DlInput v-model="form.email" type="email" :label="t('users.fields.email')" :hint="t('users.add.emailHint')" :error="errors.email" autocomplete="off" />
        <DlInput v-model="form.phone" type="tel" inputmode="numeric" :label="t('users.fields.phone')" :error="errors.phone" placeholder="0555123456" />
        <div class="flex flex-col gap-3.5">
          <DlCombobox v-model="form.wilaya_id" :label="t('users.fields.wilaya')" :options="lookups.wilayas.value" />
          <DlCombobox v-model="form.commune_id" :label="t('users.fields.commune')" :options="communes" :disabled="!form.wilaya_id" :error="errors.commune_id" />
        </div>
        <DlInput v-model="form.address" :label="t('users.fields.addressOptional')" :error="errors.address" />
        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] font-semibold">{{ t('users.fields.language') }}</span>
          <DlSegmented v-if="languageItems.length" v-model="languageModel" :label="t('users.fields.language')" :items="languageItems" block />
          <p v-if="errors.language_id" class="text-xs text-dl-rejected">{{ errors.language_id }}</p>
        </div>
      </form>

      <!-- 2 · Role -->
      <form v-else-if="step === 1" id="user-add" class="flex flex-col gap-3.5" novalidate @submit.prevent="next">
        <DlSelect v-model="form.role" :label="t('users.columns.role')" :options="lookups.roles.value" :placeholder="t('users.add.choose')" />
        <p v-if="errors.role" class="-mt-2 text-xs text-dl-rejected">{{ errors.role }}</p>
        <div class="flex flex-col gap-1.5">
          <DlCombobox v-model="form.team_id" :label="t('users.add.mainTeam')" :options="lookups.teams.value" :error="errors.teams" />
          <button v-if="!showSecondTeam" type="button" class="self-start text-xs font-semibold text-dl-cobalt hover:underline" @click="showSecondTeam = true">
            ＋ {{ t('users.add.anotherTeam') }}
          </button>
        </div>
        <DlCombobox v-if="showSecondTeam" v-model="form.second_team_id" :label="t('users.add.secondTeam')" :options="lookups.teams.value.filter(team => team.value !== form.team_id)" />
        <DlCombobox
          v-model="form.manager_id"
          :label="t('users.columns.manager')"
          :options="lookups.people.value"
          :hint="managerHint ?? t('users.add.managerOptional')"
          :error="errors.managers"
          @update:model-value="touch('manager')"
        />
        <DlCombobox v-if="auth.can('territories.show')" v-model="form.territory_id" :label="t('users.columns.territory')" :options="lookups.territories.value" :hint="t('users.add.territoryHint')" :error="errors.territory" />
        <DlInput v-model="form.start_date" type="date" :label="t('users.add.startsOn')" :hint="t('users.add.startsOnHint')" :error="errors.start_date" />
      </form>

      <!-- 3 · Rules -->
      <form v-else id="user-add" class="flex flex-col gap-3.5" novalidate @submit.prevent="save">
        <div class="flex flex-col gap-1.5">
          <RulePicker v-model="form.planning_rule_id" kind="planning" :label="t('users.rules.planning')" :placeholder="t('users.rules.none')" :error="errors.planning_rule_id" @update:model-value="touch('planning')" />
          <p v-if="why('planning_rule')" class="rounded-[10px] bg-dl-mist px-2.5 py-2 text-xs text-dl-muted">{{ why('planning_rule') }}</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <RulePicker v-model="form.validation_rule_id" kind="validation" :label="t('users.rules.validation')" :placeholder="t('users.rules.none')" :error="errors.validation_rule_id" @update:model-value="touch('validation')" />
          <p v-if="why('validation_rule')" class="rounded-[10px] bg-dl-mist px-2.5 py-2 text-xs text-dl-muted">{{ why('validation_rule') }}</p>
        </div>
        <div v-if="auth.can('cycles.create')" class="flex flex-col gap-1.5">
          <label class="flex cursor-pointer items-center gap-3 text-[13px] font-semibold">
            <input v-model="form.first_cycle" type="checkbox" class="h-[18px] w-[18px] accent-dl-ink">
            {{ t('users.add.firstCycle') }}
          </label>
          <div v-if="form.first_cycle" class="flex flex-col gap-3.5">
            <DlInput v-model="form.cycle_start" type="date" :label="t('access.log.filter.from')" :error="errors.cycle_start" />
            <DlInput v-model="form.cycle_end" type="date" :min="form.cycle_start" :label="t('access.log.filter.to')" :error="errors.cycle_end" />
          </div>
          <p class="text-xs text-dl-muted">{{ t('users.add.cycleHint') }}</p>
        </div>
        <label class="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5" :class="form.send_access ? 'bg-dl-signal-soft ring-[1.5px] ring-dl-fg ring-inset' : 'border border-dl-line'">
          <input v-model="form.send_access" type="checkbox" class="mt-0.5 h-[18px] w-[18px] accent-dl-ink">
          <span class="flex flex-col">
            <strong class="text-sm">{{ t('users.add.sendAccess') }}</strong>
            <span class="text-xs text-dl-muted">{{ t('users.add.sendAccessHint') }}</span>
          </span>
        </label>
      </form>
    </div>

    <template #footer>
      <DlButton variant="ghost" @click="step ? step-- : (open = false)">{{ t(step ? 'users.add.back' : 'common.actions.cancel') }}</DlButton>
      <DlButton v-if="step < LAST" type="submit" form="user-add" variant="dark" class="ms-auto">{{ t('users.add.next') }}</DlButton>
      <DlButton v-else type="submit" form="user-add" variant="primary" class="ms-auto" :loading="saving">
        {{ form.first_name.trim() ? t('users.add.saveNamed', { name: form.first_name.trim() }) : t('users.add.save') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>
