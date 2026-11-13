<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldErrors } from '@/api/errors'
import { assignTerritoryPerson, endTerritoryStint, fetchTerritories, fetchTerritoryPeople, type Territory, type TerritoryCover, type TerritoryStint } from '@/api/tenant/territories'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import { useTerritories, useUsers } from './useTerritoryLookups'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { today, useUserText } from '@/views/tenant/users/userDisplay'
import TerritoryPersonPicker from './TerritoryPersonPicker.vue'
import { coversOf, picksFromCovers } from './coversForm'
import { personName, useTerritoryText } from './territoryText'
import { usePeopleSuggestions } from './usePeopleSuggestions'

// Who works a territory: now (End… on a date), coming, before; "Assign" someone from a date (their
// territory elsewhere ends the day before — said before saving), suggested people first from what it
// `covers`. `limit` keeps the past short (panel).
const props = defineProps<{ territoryId: number; covers?: TerritoryCover[]; limit?: number }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const text = useTerritoryText()
const userText = useUserText()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const users = useUsers()
const sharedTerritories = useTerritories()

const mode = ref<'list' | 'assign' | 'end'>('list')
const rows = ref<TerritoryStint[]>([])
const loading = ref(false)
async function load() {
  loading.value = true
  try {
    rows.value = await fetchTerritoryPeople(props.territoryId)
  }
  finally {
    loading.value = false
  }
}
watch(() => props.territoryId, () => {
  mode.value = 'list'
  load()
}, { immediate: true })

const active = computed(() => rows.value.filter(row => row.state !== 'past'))
const past = computed(() => rows.value.filter(row => row.state === 'past'))
const showAll = ref(false)
const shownPast = computed(() => (props.limit && !showAll.value ? past.value.slice(0, props.limit) : past.value))

function after(changedRows: TerritoryStint[]) {
  rows.value = changedRows
  mode.value = 'list'
  emit('changed')
  if (sharedTerritories.loaded.value) sharedTerritories.refresh()
  if (users.loaded.value) users.refresh()
}
const { te: has } = useI18n()
const errorText = (code?: string) => (code && has(`territories.errors.${code}`) ? t(`territories.errors.${code}`) : code ?? '')

// ── Assign ───────────────────────────────────────────────────
const form = ref({ user: null as number | null, start: today() })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const working = computed(() => new Set(active.value.map(row => row.user.id)))
const suggestions = usePeopleSuggestions(() => (mode.value === 'assign' ? coversOf(picksFromCovers(props.covers)) : null))

// Their territory today, to say it will end.
const elsewhere = ref<Territory | null>(null)
watch(() => form.value.user, async id => {
  elsewhere.value = null
  if (!id) return
  const { items } = await fetchTerritories({ 'filter[user_id]': id, per_page: 1 })
  elsewhere.value = items[0] && items[0].id !== props.territoryId ? items[0] : null
})
const endsOn = computed(() => {
  const day = new Date(`${form.value.start}T12:00:00`)
  day.setDate(day.getDate() - 1)
  return userText.date(day.toISOString().slice(0, 10))
})

function startAssign() {
  form.value = { user: null, start: today() }
  errors.value = {}
  mode.value = 'assign'
  users.ensureLoaded()
}
async function assign() {
  errors.value = {}
  if (!form.value.user) errors.value.user_id = t('users.add.required')
  if (!form.value.start) errors.value.start_date = t('users.add.required')
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    after(await assignTerritoryPerson(props.territoryId, { user_id: form.value.user!, start_date: form.value.start }))
    toast.success(t('territories.people.assigned'))
  }
  catch (error) {
    const found = fieldErrors(error)
    if (Object.keys(found).length) errors.value = Object.fromEntries(Object.entries(found).map(([key, text]) => [key, errorText(text)]))
    else toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

// ── End ──────────────────────────────────────────────────────
const ending = ref<TerritoryStint | null>(null)
const endDate = ref(today())
function startEnd(row: TerritoryStint) {
  ending.value = row
  endDate.value = row.start_date > today() ? row.start_date : today()
  errors.value = {}
  mode.value = 'end'
}
async function end() {
  if (!ending.value) return
  saving.value = true
  errors.value = {}
  try {
    after(await endTerritoryStint(props.territoryId, ending.value.id, endDate.value))
    toast.success(t('territories.people.ended'))
  }
  catch (error) {
    const found = fieldErrors(error)
    if (found.end_date) errors.value = { end_date: errorText(found.end_date) }
    else toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="rounded-2xl border border-dl-line">
    <header class="flex items-center gap-2 px-3.5 pb-1.5 pt-3">
      <h3 class="flex-1 text-sm font-semibold">{{ t('territories.people.title') }}</h3>
      <DlButton v-if="canUpdate('territories') && mode === 'list'" variant="outline" size="sm" icon="tabler-plus" @click="startAssign">{{ t('territories.people.assign') }}</DlButton>
    </header>

    <form v-if="mode === 'assign'" class="flex flex-col gap-3 border-t border-dl-line-soft px-3.5 py-3" @submit.prevent="assign">
      <TerritoryPersonPicker v-model="form.user" :suggestions="suggestions" :exclude="[...working]" :label="t('territories.people.person')" :error="errors.user_id" />
      <p v-if="form.user && suggestions.note(form.user)" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[13px] font-semibold text-dl-pending">{{ suggestions.note(form.user) }}</p>
      <p v-if="elsewhere" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[13px]">
        <strong class="text-dl-pending">{{ t('territories.people.worksElsewhere', { name: elsewhere.name }) }}</strong>
        {{ t('territories.people.willEnd', { date: endsOn }) }}
      </p>
      <DlInput v-model="form.start" type="date" :label="t('territories.people.startsOn')" :error="errors.start_date" />
      <div class="flex justify-end gap-2">
        <DlButton variant="ghost" type="button" @click="mode = 'list'">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton variant="primary" type="submit" :loading="saving">{{ t('territories.people.assign') }}</DlButton>
      </div>
    </form>

    <form v-else-if="mode === 'end' && ending" class="flex flex-col gap-3 border-t border-dl-line-soft px-3.5 py-3" @submit.prevent="end">
      <p class="text-[13px]">{{ t('territories.people.endOf', { name: personName(ending.user) }) }}</p>
      <DlInput v-model="endDate" type="date" :min="ending.start_date" :label="t('territories.people.lastDay')" :error="errors.end_date" />
      <div class="flex justify-end gap-2">
        <DlButton variant="ghost" type="button" @click="mode = 'list'">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton variant="dark" type="submit" :loading="saving">{{ t('territories.people.end') }}</DlButton>
      </div>
    </form>

    <template v-else>
      <p v-if="!loading && !active.length" class="border-t border-dl-line-soft px-3.5 py-2.5 text-[13px] font-semibold text-dl-pending">{{ t('territories.people.nobody') }}</p>
      <ul>
        <li v-for="row in active" :key="row.id" class="flex items-center gap-2.5 border-t border-dl-line-soft px-3.5 py-2 text-[13px]">
          <DlAvatar :name="personName(row.user)" size="sm" />
          <span class="flex min-w-0 flex-1 flex-col">
            <RouterLink :to="{ name: 'tenant-user-detail', params: { id: row.user.id } }" class="truncate font-semibold hover:text-dl-cobalt">{{ personName(row.user) }}</RouterLink>
            <span class="text-xs text-dl-muted">{{ text.stint(row) }}</span>
          </span>
          <DlButton v-if="canUpdate('territories')" variant="outline" size="sm" @click="startEnd(row)">{{ t('territories.people.endButton') }}</DlButton>
        </li>
        <li v-for="row in shownPast" :key="row.id" class="flex items-center gap-2.5 border-t border-dl-line-soft px-3.5 py-2 text-[13px] text-dl-muted">
          <DlAvatar :name="personName(row.user)" size="sm" tone="neutral" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate">{{ personName(row.user) }}</span>
            <span class="text-xs">{{ text.stint(row) }}</span>
          </span>
        </li>
      </ul>
      <button v-if="limit && past.length > limit && !showAll" type="button" class="border-t border-dl-line-soft px-3.5 py-2 text-start text-[13px] font-semibold text-dl-cobalt hover:underline" @click="showAll = true">
        {{ t('territories.people.morePast', { n: past.length - limit }) }}
      </button>
    </template>
  </section>
</template>
