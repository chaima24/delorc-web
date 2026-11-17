<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import type { Campaign } from '@/api/tenant/campaigns'
import { fetchSpecialities } from '@/api/tenant/customerSetup'
import { fetchActivityTypes } from '@/api/tenant/fieldSetup'
import { fetchWilayas } from '@/api/tenant/geography'
import { createAction, fetchActionPeople, updateAction, type ActionPerson, type MarketingAction } from '@/api/tenant/marketingActions'
import DlButton from '@/components/DlButton.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSheet from '@/components/DlSheet.vue'
import { refreshOnFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

// « + Ajouter une action » / « Modifier » (mockup frame 2): a large sheet, as every window inside a campaign. The
// people come from the campaign's teams; those whose role can't record the type are named apart.
const props = defineProps<{ campaign: Pick<Campaign, 'id' | 'name' | 'start_date' | 'end_date'>; action?: MarketingAction | null }>()
const emit = defineEmits<{ saved: [action: MarketingAction] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const toast = useToast()

type Option = { value: number; label: string }
const types = ref<Option[]>([])
const wilayas = ref<Option[]>([])
const specialities = ref<Option[]>([])
const all = { page: 1, per_page: 100 }
function loadLists() {
  Promise.all([fetchActivityTypes({ ...all, sort: 'activity' }), fetchWilayas({ ...all, sort: 'name' }), fetchSpecialities({ ...all, sort: 'name' })])
    .then(([ty, w, s]) => {
      types.value = ty.items.map(row => ({ value: row.id, label: row.activity }))
      wilayas.value = w.items.map(row => ({ value: row.id, label: row.name }))
      specialities.value = s.items.filter(row => row.type === 'medecin').map(row => ({ value: row.id, label: row.name }))
    }).catch(() => undefined)
}
loadLists()
refreshOnFocus(loadLists)

const empty = () => ({ activity_type_id: '' as number | '', start_date: props.campaign.start_date, end_date: props.campaign.end_date, objective: '1',
  user_ids: [] as number[], budget: '', wilaya_id: '' as number | '', address: '', speciality_ids: [] as number[] })
const form = ref(empty())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  const a = props.action
  form.value = a
    ? { activity_type_id: a.activity_type.id, start_date: a.start_date, end_date: a.end_date, objective: String(a.objective), user_ids: [...(a.user_ids ?? [])],
        budget: String(a.budget), wilaya_id: a.wilaya?.id ?? '', address: a.address ?? '', speciality_ids: a.specialities.map(s => s.id) }
    : empty()
  errors.value = {}
}, { immediate: true })

// Who may be in it, read again when the type changes.
const people = ref<ActionPerson[]>([])
watch(() => form.value.activity_type_id, async id => {
  people.value = id ? await fetchActionPeople(props.campaign.id, Number(id)).catch(() => []) : []
  const can = new Set(people.value.filter(p => p.can).map(p => p.user_id))
  if (people.value.length) form.value.user_ids = form.value.user_ids.filter(user => can.has(user))
}, { immediate: true })
const personItems = computed(() => people.value.filter(p => p.can).map(p => ({ value: p.user_id, label: p.name, hint: [p.team, p.role ? roleLabel(p.role) : null].filter(Boolean).join(' · ') })))
const greyed = computed(() => people.value.filter(p => !p.can).map(p => `${p.name}${p.role ? ` (${roleLabel(p.role)})` : ''}`))
const teamPick = ref<string | number>('')
const teamItems = computed(() => [...new Set(people.value.filter(p => p.can && p.team).map(p => p.team!))].sort().map(team => ({ value: team, label: team })))
function addTeam(value: string | number | null | undefined) {
  if (!value) return
  form.value.user_ids = [...new Set([...form.value.user_ids, ...people.value.filter(p => p.can && p.team === value).map(p => p.user_id)])]
  teamPick.value = ''
}
const planned = computed(() => (Number(form.value.objective) || 0) * form.value.user_ids.length)

const number = (value: string) => (value.trim() === '' ? null : Number(value.replace(/\s/g, '').replace(',', '.')))
async function save() {
  errors.value = {}
  saving.value = true
  const f = form.value
  const payload = {
    activity_type_id: f.activity_type_id === '' ? null : Number(f.activity_type_id), start_date: f.start_date, end_date: f.end_date,
    objective: number(f.objective), user_ids: f.user_ids, budget: number(f.budget), wilaya_id: f.wilaya_id === '' ? null : Number(f.wilaya_id),
    address: f.address.trim() || null, speciality_ids: f.speciality_ids,
  }
  try {
    const saved = props.action ? await updateAction(props.action.id, payload) : await createAction({ ...payload, campaign_id: props.campaign.id })
    toast.success(t('studio.list.toast.saved'))
    emit('saved', saved)
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlSheet v-model:open="open" size="lg" :title="action ? t('actions.sheet.editTitle') : t('actions.sheet.addTitle')" :description="t('actions.sheet.description', { name: campaign.name })">
    <form id="action-sheet" class="flex flex-col gap-4" @submit.prevent="save">
      <div class="grid items-start gap-3 sm:grid-cols-[2fr_1fr]">
        <div class="flex flex-col gap-1">
          <DlSelect v-model="form.activity_type_id" :label="t('actions.fields.type')" :options="types" :placeholder="t('actions.fields.choose')" />
          <span class="text-xs" :class="errors.activity_type_id ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.activity_type_id ?? t('actions.fields.typeHint') }}</span>
        </div>
        <DlInput v-model="form.objective" inputmode="numeric" :label="t('actions.fields.objective')" :hint="t('actions.fields.objectiveHint')" :error="errors.objective" />
      </div>
      <DlDateRangePicker v-model:start="form.start_date" v-model:end="form.end_date" :label="t('actions.fields.dates')" :min="campaign.start_date" :max="campaign.end_date"
        :hint="t('actions.fields.datesHint')" :error="errors.start_date || errors.end_date" />
      <CheckList
        v-model="form.user_ids"
        :legend="t('actions.fields.people')"
        :selected-label="t('actions.fields.peopleChosen', { count: form.user_ids.length }, form.user_ids.length)"
        :search-label="t('actions.fields.peopleSearch')"
        :items="personItems"
        :empty-text="form.activity_type_id ? t('actions.fields.peopleNone') : t('actions.fields.peopleTypeFirst')"
        :error="errors.user_ids"
      />
      <div v-if="teamItems.length" class="grid gap-3 sm:grid-cols-2">
        <DlSelect v-model="teamPick" :label="t('actions.fields.addTeam')" :options="teamItems" :placeholder="t('actions.fields.choose')" @update:model-value="addTeam" />
      </div>
      <p v-if="greyed.length" class="-mt-2 text-xs text-dl-muted">{{ t('actions.fields.greyed', { names: greyed.join(', ') }) }}</p>
      <div class="grid items-start gap-3 sm:grid-cols-3">
        <DlInput v-model="form.budget" inputmode="decimal" :label="t('actions.fields.budget')" :hint="t('actions.fields.budgetHint')" :error="errors.budget" />
        <DlSelect v-model="form.wilaya_id" :label="t('actions.fields.wilaya')" :options="wilayas" :placeholder="t('actions.fields.none')" />
        <DlInput v-model="form.address" :label="t('actions.fields.place')" :error="errors.address" />
      </div>
      <CheckList
        v-model="form.speciality_ids"
        :legend="t('actions.fields.specialities')"
        :selected-label="t('actions.fields.specialitiesChosen', { count: form.speciality_ids.length }, form.speciality_ids.length)"
        :search-label="t('actions.fields.specialitySearch')"
        :items="specialities"
        :empty-text="t('actions.fields.specialitiesHint')"
        :error="errors.speciality_ids"
      />
      <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-[13px]">{{ t('actions.fields.planned', { objective: n(Number(form.objective) || 0), people: n(form.user_ids.length), planned: n(planned) }) }}</p>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="action-sheet" variant="dark" class="ms-auto" :loading="saving">{{ action ? t('common.actions.save') : t('actions.sheet.add') }}</DlButton>
    </template>
  </DlSheet>
</template>
