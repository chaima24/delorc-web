<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchTerritories, type CoverBlockPayload, type Territory } from '@/api/tenant/territories'
import DlAvatar from '@/components/DlAvatar.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import { useUsers } from './useTerritoryLookups'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useUserText } from '@/views/tenant/users/userDisplay'
import TerritoryPersonPicker from './TerritoryPersonPicker.vue'
import { usePeopleSuggestions } from './usePeopleSuggestions'

// Step 3 of adding a territory: the people who will work it (optional, as many as needed), all
// starting the same day. Suggested people first (TerritoryPersonPicker). Flagged: someone who works
// another territory now (it ends the day before), someone picked who isn't suggested.
const props = defineProps<{ errors: Record<string, string>; covers: CoverBlockPayload[] }>()
const people = defineModel<number[]>('people', { required: true })
const start = defineModel<string>('start', { required: true })
const { t } = useI18n()
const users = useUsers()
const userText = useUserText()
users.ensureLoaded()

const nameOf = (user: { full_name: string }) => user.full_name
const suggestions = usePeopleSuggestions(() => props.covers)
const rows = computed(() => people.value.map(id => {
  const user = users.items.value.find(item => item.id === id)
  return { id, name: user ? nameOf(user) : `#${id}`, role: [user?.role ? roleLabel(user.role) : '', suggestions.where(id)].filter(Boolean).join(' · ') }
}))

// The territory each picked person works now, if any.
const elsewhere = ref<Record<number, Territory | null>>({})
const chosen = ref<number | null>(null)
watch(chosen, async id => {
  if (id == null) return
  chosen.value = null
  people.value = [...people.value, id]
  if (id in elsewhere.value) return
  const found = (await fetchTerritories({ 'filter[user_id]': id, per_page: 1 })).items[0] ?? null
  elsewhere.value = { ...elsewhere.value, [id]: found }
})
const remove = (id: number) => (people.value = people.value.filter(item => item !== id))

const endsOn = computed(() => {
  const day = new Date(`${start.value}T12:00:00`)
  day.setDate(day.getDate() - 1)
  return userText.date(day.toISOString().slice(0, 10))
})
const errorOf = (id: number) => props.errors[`people.${id}`]
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-[13px] text-dl-body">{{ t('territories.add.peopleHow') }}</p>
    <TerritoryPersonPicker v-model="chosen" :suggestions="suggestions" :exclude="people" :label="t('territories.people.add')" :error="errors.user_ids" />

    <ul v-if="rows.length" class="rounded-2xl border border-dl-line">
      <li v-for="row in rows" :key="row.id" class="flex flex-col gap-1.5 border-t border-dl-line-soft px-3.5 py-2.5 text-[13px] first:border-0">
        <span class="flex items-center gap-2.5">
          <DlAvatar :name="row.name" size="sm" />
          <span class="flex min-w-0 flex-1 flex-col">
            <strong class="truncate font-semibold">{{ row.name }}</strong>
            <span v-if="row.role" class="truncate text-xs text-dl-muted">{{ row.role }}</span>
          </span>
          <button type="button" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dl-muted hover:bg-dl-mist hover:text-dl-fg" :aria-label="t('territories.covers.remove', { name: row.name })" @click="remove(row.id)">
            <DlIcon icon="tabler-x" :size="16" />
          </button>
        </span>
        <span v-if="elsewhere[row.id]" class="rounded-lg bg-dl-pending/10 px-2.5 py-1.5">
          <strong class="text-dl-pending">{{ t('territories.people.worksElsewhere', { name: elsewhere[row.id]!.name }) }}</strong>
          {{ t('territories.people.willEnd', { date: endsOn }) }}
        </span>
        <span v-if="suggestions.note(row.id)" class="rounded-lg bg-dl-pending/10 px-2.5 py-1.5 font-semibold text-dl-pending">{{ suggestions.note(row.id) }}</span>
        <span v-if="errorOf(row.id)" class="text-[12.5px] text-dl-rejected" role="alert">{{ errorOf(row.id) }}</span>
      </li>
    </ul>

    <DlInput v-if="people.length" v-model="start" type="date" :label="people.length > 1 ? t('territories.people.allStartOn') : t('territories.people.startsOn')" :error="errors.start_date" />
  </div>
</template>
