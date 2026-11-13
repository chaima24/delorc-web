<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisitOfferedAdv } from '@/api/tenant/visits'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import VisitRating from './VisitRating.vue'
import VisitTargetSearch from './VisitTargetSearch.vue'

export interface BrandRow { brand_id: number; feedback: number | null; stock: string }
export interface AdvRow { adv_id: number; feedback: number | null }
export interface Named { id: number; name: string }
/** The report as the forms hold it (the add page and the cards of a visit's page). */
export interface ReportForm {
  brands: BrandRow[]
  advs: AdvRow[]
  coaches: Named[]
  participants: Named[]
  replacement: Named | null
}

// The three report blocks that are lists: brands presented (interest, stock), ADVs shown (rating), people.
// `part` shows one of them, so the add page and each card of the visit's page use the same fields.
const props = defineProps<{
  part: 'brands' | 'advs' | 'people'
  brandOptions: { value: number; label: string }[]
  /** Pharmacies, wholesalers and organisations also give the stock seen. */
  stock: boolean
  offered: VisitOfferedAdv[]
  coachOptions: { id: number; full_name: string; role: string | null }[]
  targetName: string
  errors: Record<string, string>
  /** The lab's grid for this person and target (docs/api/visit-report-fields.md): hidden fields are not shown, required ones get a star. */
  fields?: Record<string, string> | null
}>()
const form = defineModel<ReportForm>({ required: true })
const { t } = useI18n()
const rule = (key: string) => props.fields?.[key] ?? 'optional'
const shown = (key: string) => rule(key) !== 'hidden'
const star = (key: string) => (rule(key) === 'required' ? ' *' : '')

const brandName = (id: number) => props.brandOptions.find(option => option.value === id)?.label ?? ''
const brandsLeft = computed(() => props.brandOptions.filter(option => !form.value.brands.some(row => row.brand_id === option.value)))
const addBrand = (value?: string | number | null) => { if (value != null) form.value.brands.push({ brand_id: Number(value), feedback: null, stock: '' }) }

const advRow = (id: number) => form.value.advs.find(row => row.adv_id === id)
function toggleAdv(id: number) {
  const index = form.value.advs.findIndex(row => row.adv_id === id)
  if (index >= 0) form.value.advs.splice(index, 1)
  else form.value.advs.push({ adv_id: id, feedback: null })
}

const coachesLeft = computed(() => props.coachOptions.filter(person => !form.value.coaches.some(row => row.id === person.id)).map(person => ({ value: person.id, label: person.full_name, hint: roleLabel(person.role) })))
function addCoach(value?: string | number | null) {
  const person = props.coachOptions.find(row => row.id === Number(value))
  if (person) form.value.coaches.push({ id: person.id, name: person.full_name })
}
const addParticipant = (row: Named) => { if (!form.value.participants.some(one => one.id === row.id)) form.value.participants.push({ id: row.id, name: row.name }) }
const sawReplacement = computed({
  get: () => (form.value.replacement ? 'yes' : replacing.value ? 'yes' : 'no'),
  set: (value) => {
    replacing.value = value === 'yes'
    if (value === 'no') form.value.replacement = null
  },
})
const replacing = defineModel<boolean>('replacing', { default: false })
const yesNo = computed(() => [{ value: 'no', label: t('visits.people.no') }, { value: 'yes', label: t('visits.people.yes') }])
</script>

<template>
  <div v-if="part === 'brands'" class="flex flex-col gap-2">
    <div v-for="(row, index) in form.brands" :key="row.brand_id" class="flex flex-wrap items-center gap-2.5 border-b border-dl-line-soft py-2 text-[13.5px]">
      <strong class="min-w-0 flex-1 font-semibold">{{ brandName(row.brand_id) }}</strong>
      <template v-if="shown('brand_feedback')">
        <span class="text-xs text-dl-muted">{{ t('visits.brands.interest') }}{{ star('brand_feedback') }}</span>
        <VisitRating v-model="row.feedback" :label="t('visits.brands.interestOf', { name: brandName(row.brand_id) })" />
      </template>
      <div v-if="stock && shown('brand_stock')" class="w-28"><DlInput v-model="row.stock" type="number" min="0" :label="t('visits.brands.stock')" :placeholder="t('visits.brands.stock') + star('brand_stock')" hide-label /></div>
      <DlIconButton icon="tabler-x" variant="ghost" :size="32" :label="t('visits.brands.remove', { name: brandName(row.brand_id) })" @click="form.brands.splice(index, 1)" />
      <span v-if="errors[`brands.${index}.feedback`] || errors[`brands.${index}.stock`]" class="w-full text-xs text-dl-rejected">{{ errors[`brands.${index}.feedback`] ?? errors[`brands.${index}.stock`] }}</span>
    </div>
    <DlCombobox :model-value="null" :label="t('visits.brands.add')" :placeholder="t('visits.brands.add')" :options="brandsLeft" :error="errors.brands" hide-label @update:model-value="addBrand" />
    <p class="text-xs text-dl-muted">{{ t(stock ? 'visits.brands.hintStock' : 'visits.brands.hint') }}</p>
  </div>

  <div v-else-if="part === 'advs'" class="flex flex-col gap-1">
    <label v-for="adv in offered" :key="adv.id" class="flex flex-wrap items-center gap-2.5 border-b border-dl-line-soft py-2 text-[13.5px]">
      <input type="checkbox" class="h-4 w-4 accent-dl-fg" :checked="!!advRow(adv.id)" @change="toggleAdv(adv.id)">
      <span class="min-w-0 flex-1">
        <strong class="block font-semibold">{{ adv.name }}</strong>
        <small class="text-xs text-dl-muted">{{ [t(`advs.type.${adv.type}`), adv.brand].filter(Boolean).join(' · ') }}</small>
      </span>
      <template v-if="advRow(adv.id) && shown('adv_feedback')">
        <span class="text-xs text-dl-muted">{{ t('visits.advs.rating') }}{{ star('adv_feedback') }}</span>
        <VisitRating v-model="advRow(adv.id)!.feedback" :label="t('visits.advs.ratingOf', { name: adv.name })" />
      </template>
    </label>
    <span v-if="errors.advs || Object.keys(errors).some(key => key.startsWith('advs.'))" class="text-xs text-dl-rejected">{{ errors.advs ?? Object.entries(errors).find(([key]) => key.startsWith('advs.'))?.[1] }}</span>
    <p class="text-xs text-dl-muted">{{ offered.length ? t('visits.advs.hint') : t(form.brands.length ? 'visits.advs.none' : 'visits.advs.brandsFirst') }}</p>
  </div>

  <div v-else class="flex flex-col gap-4">
    <div class="grid gap-4 lg:grid-cols-2">
      <div v-if="shown('coaches')" class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('visits.fields.coaches') }}{{ star('coaches') }}</span>
        <span v-for="(row, index) in form.coaches" :key="row.id" class="flex items-center justify-between rounded-xl bg-dl-mist px-3 py-1.5 text-[13.5px]">
          {{ row.name }}<DlIconButton icon="tabler-x" variant="ghost" :size="28" :label="t('visits.people.remove', { name: row.name })" @click="form.coaches.splice(index, 1)" />
        </span>
        <DlCombobox :model-value="null" :label="t('visits.fields.coaches')" :placeholder="t('visits.people.addCoach')" :options="coachesLeft" :error="errors.coaches" hide-label @update:model-value="addCoach" />
      </div>
      <div v-if="shown('participants')" class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('visits.fields.participants') }}{{ star('participants') }}</span>
        <span v-for="(row, index) in form.participants" :key="row.id" class="flex items-center justify-between rounded-xl bg-dl-mist px-3 py-1.5 text-[13.5px]">
          {{ row.name }}<DlIconButton icon="tabler-x" variant="ghost" :size="28" :label="t('visits.people.remove', { name: row.name })" @click="form.participants.splice(index, 1)" />
        </span>
        <VisitTargetSearch type="hcp" :label="t('visits.fields.participants')" :error="errors.participants" @pick="addParticipant" />
      </div>
    </div>
    <div v-if="shown('replacement')" class="flex flex-col gap-1.5">
      <span class="text-[13px] font-semibold">{{ t('visits.people.replacement') }}{{ star('replacement') }}</span>
      <DlSegmented v-model="sawReplacement" :label="t('visits.people.replacement')" :items="yesNo" class="self-start" />
      <template v-if="sawReplacement === 'yes'">
        <span v-if="form.replacement" class="flex items-center justify-between rounded-xl bg-dl-mist px-3 py-1.5 text-[13.5px]">
          {{ form.replacement.name }}<DlIconButton icon="tabler-x" variant="ghost" :size="28" :label="t('visits.people.remove', { name: form.replacement.name })" @click="form.replacement = null" />
        </span>
        <VisitTargetSearch v-else type="hcp" :label="t('visits.people.replacement')" @pick="row => (form.replacement = { id: row.id, name: row.name })" />
        <span class="text-xs text-dl-muted">{{ t('visits.people.replacementHint', { name: targetName }) }}</span>
      </template>
      <span v-if="errors.hcp_replacement_id" class="text-xs text-dl-rejected">{{ errors.hcp_replacement_id }}</span>
    </div>
  </div>
</template>
