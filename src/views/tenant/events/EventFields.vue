<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import type { EventForm } from './eventForm'
import { useEventLookups } from './useEventLookups'

// The event's fields, in the create / propose panel and in the page's card edited in place (mockup frames 2, 3).
defineProps<{ errors: Record<string, string>; manage: boolean }>()
const form = defineModel<EventForm>({ required: true })
const { t } = useI18n()
const { types, campaigns, wilayas, specialities, people } = useEventLookups()

const NONE = 'none'
const campaign = computed({
  get: () => form.value.campaign_id ?? NONE,
  set: value => { form.value.campaign_id = value === NONE || value == null ? null : Number(value) },
})
const campaignItems = computed(() => [{ value: NONE, label: t('events.fields.noCampaign') }, ...campaigns.value])
const campaignDates = computed(() => campaigns.value.find(row => row.value === form.value.campaign_id))
const typeModel = computed({ get: () => form.value.event_type_id ?? '', set: value => { form.value.event_type_id = value === '' ? null : Number(value) } })
const wilayaModel = computed({ get: () => form.value.wilaya_id ?? '', set: value => { form.value.wilaya_id = value === '' ? null : Number(value) } })
const targets = computed(() => (['doctor', 'pharmacy', 'both'] as const).map(value => ({ value, label: t(`events.target.${value}`) })))

const personItems = computed(() => people.value.map(p => ({ value: p.id, label: p.full_name, hint: [p.role ? roleLabel(p.role) : null, ...p.teams.map(team => team.name)].filter(Boolean).join(' · ') })))
// « + Les personnes d'une équipe »: every person of the team the viewer may add.
const teamPick = ref<string | number>('')
const teamItems = computed(() => {
  const seen = new Map<number, string>()
  people.value.forEach(p => p.teams.forEach(team => seen.set(team.id, team.name)))
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
})
function addTeam(value: string | number | null | undefined) {
  if (value == null || value === '') return
  const ids = people.value.filter(p => p.teams.some(team => team.id === Number(value))).map(p => p.id)
  form.value.user_ids = [...new Set([...form.value.user_ids, ...ids])]
  teamPick.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-4">
      <DlInput v-model="form.name" :label="t('events.fields.name')" :error="errors.name" />
      <DlSelect v-model="typeModel" :label="t('events.fields.type')" :options="types" :placeholder="t('events.fields.choose')" />
    </div>
    <p v-if="errors.event_type_id" class="-mt-2 text-xs text-dl-rejected">{{ errors.event_type_id }}</p>
    <div class="flex flex-col gap-1.5">
      <DlSelect v-model="campaign" :label="t('events.fields.campaign')" :options="campaignItems" />
      <span class="text-xs text-dl-muted">{{ campaignDates ? t('events.fields.campaignDates') : t('events.fields.campaignHint') }}</span>
    </div>
    <DlDateRangePicker v-model:start="form.start_date" v-model:end="form.end_date" :label="t('events.fields.dates')" :min="campaignDates?.start" :max="campaignDates?.end"
      :hint="t('events.fields.datesHint')" :error="errors.start_at || errors.end_at" />
    <div class="flex flex-col gap-4">
      <DlInput v-model="form.start_time" type="time" :label="t('events.fields.startTime')" />
      <DlInput v-model="form.end_time" type="time" :label="t('events.fields.endTime')" />
    </div>
    <div class="flex flex-col gap-4">
      <DlSelect v-model="wilayaModel" :label="t('events.fields.wilaya')" :options="wilayas" :placeholder="t('events.fields.choose')" />
      <DlInput v-model="form.place" :label="t('events.fields.place')" :error="errors.place" />
    </div>
    <p v-if="errors.wilaya_id" class="-mt-2 text-xs text-dl-rejected">{{ errors.wilaya_id }}</p>
    <DlInput v-model="form.online_url" :label="t('events.fields.onlineUrl')" placeholder="https://…" :hint="t('events.fields.onlineHint')" :error="errors.online_url" />
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-semibold">{{ t('events.fields.target') }}</span>
      <DlSegmented v-model="form.type" :label="t('events.fields.target')" :items="targets" block />
    </div>
    <CheckList
      v-if="form.type !== 'pharmacy'"
      v-model="form.speciality_ids"
      :legend="t('events.fields.specialities')"
      :selected-label="t('events.fields.specialitiesChosen', { count: form.speciality_ids.length }, form.speciality_ids.length)"
      :search-label="t('events.fields.specialitySearch')"
      :items="specialities"
      :empty-text="t('events.fields.specialitiesAll')"
      :error="errors.speciality_ids"
    />
    <DlInput v-model="form.costs" inputmode="decimal" :label="t('events.fields.costs')" :hint="t('events.fields.costsHint')" :error="errors.costs" />
      <CheckList
        v-model="form.user_ids"
        :legend="t('events.fields.participants')"
        :selected-label="t('events.fields.participantsChosen', { count: form.user_ids.length }, form.user_ids.length)"
        :search-label="t('events.fields.participantSearch')"
        :items="personItems"
        :empty-text="t('events.fields.participantsNone')"
        :error="errors.user_ids"
      />
      <div v-if="manage && teamItems.length">
        <DlSelect v-model="teamPick" :label="t('events.fields.addTeam')" :options="teamItems" :placeholder="t('events.fields.choose')" @update:model-value="addTeam" />
      </div>
    <DlTextarea v-model="form.object" :label="t('events.fields.object')" :rows="3" :error="errors.object" />
  </div>
</template>
