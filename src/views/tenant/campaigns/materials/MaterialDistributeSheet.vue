<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchCampaignGrid, fetchCampaignSettings, type Campaign, type CampaignGrid } from '@/api/tenant/campaigns'
import { fetchMateriels, type Materiel } from '@/api/tenant/fieldSetup'
import { createMaterialDistribution, fetchMaterialRecipients, type MaterialDistribution, type MaterialRecipient, type MaterialType } from '@/api/tenant/materials'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

// « + Distribuer un matériel »: type, material (a role or all), brand (the grid's), specialities (pre-filled from the
// grid for that brand), unit cost, one quantity for all; then each person: untick, change the quantity, see what they
// still have. The period comes from the lab's setting (the campaign's dates, or a month). Mockup frame 2.
const props = defineProps<{ campaign: Campaign }>()
const emit = defineEmits<{ created: [distribution: MaterialDistribution] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n, d } = useI18n()
const toast = useToast()

const grid = ref<CampaignGrid | null>(null)
const materiels = ref<Materiel[]>([])
const perCycle = ref(false)
watch(open, async value => {
  if (!value) return
  const [g, m, settings] = await Promise.all([
    fetchCampaignGrid(props.campaign.id),
    fetchMateriels({ page: 1, per_page: 100, include: 'role', sort: 'name' }),
    fetchCampaignSettings(),
  ])
  grid.value = g
  materiels.value = m.items
  perCycle.value = (settings as { material_period?: string }).material_period === 'cycle'
}, { immediate: true })

const form = ref({ type: 'visit' as MaterialType, materiel_id: 0, brand_id: 0, speciality_ids: [] as number[], unit_cost: '', quantity: '20', month: '' })
const errors = ref<Record<string, string>>({})
const brandItems = computed(() => {
  const ids = new Set((grid.value?.ticks ?? []).map(tick => tick.brand_id))
  return (grid.value?.brands ?? []).filter(brand => ids.has(brand.id)).map(brand => ({ value: brand.id, label: brand.name }))
})
const specialityItems = computed(() => {
  const seen = new Map<number, string>()
  for (const team of grid.value?.teams ?? []) team.specialities.forEach(s => seen.set(s.id, s.name))
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
})
const materielItems = computed(() => materiels.value.map(m => ({ value: m.id, label: `${m.name} · ${m.role ? roleLabel(m.role.name) : t('fieldSetup.allFieldRoles')}` })))
// Per-cycle mode: the months the campaign covers ('2026-11-01'…), each rep gets their own cycle of that month.
const monthItems = computed(() => {
  const out: { value: string; label: string }[] = []
  const end = new Date(`${props.campaign.end_date.slice(0, 7)}-01T00:00:00`)
  for (let day = new Date(`${props.campaign.start_date.slice(0, 7)}-01T00:00:00`); day <= end; day = new Date(day.getFullYear(), day.getMonth() + 1, 1)) {
    const value = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-01`
    out.push({ value, label: d(day, { month: 'long', year: 'numeric' }) })
  }
  return out
})
const month = computed({ get: () => form.value.month || null, set: value => { form.value.month = String(value ?? '') } })
const typeItems = computed(() => (['visit', 'event'] as const).map(value => ({ value, label: t(`materials.type.${value}`) })))
const typeModel = computed({ get: () => form.value.type, set: value => { form.value.type = value as MaterialType } })
const materiel = computed({ get: () => form.value.materiel_id || null, set: value => { form.value.materiel_id = Number(value ?? 0) } })
const brand = computed({ get: () => form.value.brand_id || null, set: value => { form.value.brand_id = Number(value ?? 0) } })
// Picking a brand pre-fills the specialities the grid ticks for it.
watch(() => form.value.brand_id, id => {
  form.value.speciality_ids = [...new Set((grid.value?.ticks ?? []).filter(tick => tick.brand_id === id).map(tick => tick.speciality_id))]
})

// The people: reloaded when the material, the brand, the type or the month change; everyone ticked at the same quantity.
const people = ref<MaterialRecipient[] | null>(null)
const lines = ref<Record<number, { on: boolean; quantity: string }>>({})
watch(() => [form.value.materiel_id, form.value.brand_id, form.value.type, form.value.month], async ([materielId, brandId]) => {
  people.value = null
  if (!materielId || !brandId || (perCycle.value && !form.value.month)) return
  const rows = await fetchMaterialRecipients(props.campaign.id, { materiel_id: Number(materielId), brand_id: Number(brandId), type: form.value.type, month: perCycle.value ? form.value.month : null })
  people.value = rows
  lines.value = Object.fromEntries(rows.map(row => [row.user_id, { on: row.can, quantity: form.value.quantity }]))
})
function applyToAll() {
  for (const line of Object.values(lines.value)) line.quantity = form.value.quantity
}
const ticked = computed(() => (people.value ?? []).filter(row => row.can && lines.value[row.user_id]?.on))
const total = computed(() => ticked.value.reduce((sum, row) => sum + (Number(lines.value[row.user_id]?.quantity) || 0), 0))
const budget = computed(() => (form.value.unit_cost === '' ? null : total.value * Number(form.value.unit_cost)))
const money = (value: number) => `${n(value, { maximumFractionDigits: 2 })} DA`

const saving = ref(false)
async function save() {
  errors.value = {}
  saving.value = true
  try {
    const created = await createMaterialDistribution({
      campaign_id: props.campaign.id, materiel_id: form.value.materiel_id, type: form.value.type, brand_id: form.value.brand_id,
      speciality_ids: form.value.speciality_ids, unit_cost: form.value.unit_cost === '' ? null : Number(form.value.unit_cost),
      month: perCycle.value ? form.value.month : null,
      stocks: ticked.value.map(row => ({ user_id: row.user_id, quantity: Number(lines.value[row.user_id]!.quantity) || 0 })),
    })
    toast.success(t('materials.distribute.done', { count: n(total.value) }))
    emit('created', created)
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
const lineError = (index: number) => errors.value[`stocks.${index}.user_id`] || errors.value[`stocks.${index}.quantity`]
</script>

<template>
  <DlSheet v-model:open="open" size="lg" :title="t('materials.distribute.title')" :description="t('materials.distribute.description', { name: campaign.name })">
    <DlSkeleton v-if="!grid" class="h-64 rounded-2xl" />
    <form v-else id="material-distribute" class="flex flex-col gap-4" @submit.prevent="save">
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('materials.fields.type') }}</span>
        <DlSegmented v-model="typeModel" :label="t('materials.fields.type')" :items="typeItems" block />
        <span class="text-xs text-dl-muted">{{ t('materials.fields.typeHint') }}</span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <DlSelect v-model="materiel" :label="t('materials.fields.materiel')" :options="materielItems" :placeholder="t('materials.fields.pick')" />
          <span class="text-xs" :class="errors.materiel_id ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.materiel_id ?? t('materials.fields.materielHint') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <DlSelect v-model="brand" :label="t('materials.fields.brand')" :options="brandItems" :placeholder="t('materials.fields.pick')" />
          <span class="text-xs" :class="errors.brand_id ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.brand_id ?? t('materials.fields.brandHint') }}</span>
        </div>
      </div>
      <CheckList
        v-model="form.speciality_ids"
        :legend="t('materials.fields.specialities')"
        :selected-label="t('materials.fields.specialitiesChosen', { count: form.speciality_ids.length }, form.speciality_ids.length)"
        :search-label="t('materials.fields.searchSpecialities')"
        :items="specialityItems"
        :empty-text="t('materials.fields.noSpeciality')"
        :error="errors.speciality_ids"
      />
      <!-- Same shape for the three: label, a 44 px box, then an optional small line, aligned at the top. -->
      <div class="grid items-start gap-3 sm:grid-cols-3">
        <div v-if="perCycle" class="flex flex-col gap-1">
          <DlSelect v-model="month" :label="t('materials.fields.month')" :options="monthItems" :placeholder="t('materials.fields.pick')" />
          <span v-if="errors.month" class="text-xs text-dl-rejected">{{ errors.month }}</span>
        </div>
        <div v-else class="flex flex-col gap-1.5">
          <span class="text-[13px] font-semibold text-dl-fg">{{ t('materials.fields.period') }}</span>
          <span class="flex h-11 items-center truncate rounded-xl border border-dl-line bg-dl-mist px-3.5 text-sm text-dl-muted">{{ t('materials.fields.campaignDates') }}</span>
        </div>
        <DlInput v-model="form.unit_cost" type="number" min="0" :label="t('materials.fields.unitCost')" :error="errors.unit_cost" />
        <div class="flex flex-col gap-1">
          <DlInput v-model="form.quantity" type="number" min="0" :label="t('materials.fields.quantity')" />
          <button type="button" class="self-start text-xs font-semibold text-dl-cobalt hover:underline" @click="applyToAll">{{ t('materials.distribute.applyAll') }}</button>
        </div>
      </div>
      <section class="flex flex-col gap-2 rounded-2xl border border-dl-line p-3.5">
        <header class="flex flex-wrap items-center gap-2">
          <strong class="text-sm">{{ t('materials.distribute.people') }}</strong>
          <span v-if="people" class="ms-auto rounded-full bg-dl-signal-soft px-3 py-1 text-xs font-bold">{{ t('materials.distribute.ticked', { count: n(ticked.length), total: n(total) }) }}</span>
        </header>
        <p v-if="!form.materiel_id || !form.brand_id || (perCycle && !form.month)" class="py-3 text-[13px] text-dl-muted">{{ t('materials.distribute.pickFirst') }}</p>
        <DlSkeleton v-else-if="!people" class="h-32 rounded-xl" />
        <p v-else-if="!people.length" class="py-3 text-[13px] text-dl-muted">{{ t('materials.distribute.nobody') }}</p>
        <table v-else class="w-full text-[13.5px]">
          <thead><tr class="border-b border-dl-line text-xs text-dl-muted">
            <th class="w-9 py-2" /><th class="py-2 text-start font-semibold">{{ t('materials.columns.person') }}</th>
            <th class="py-2 text-start font-semibold">{{ t('materials.columns.teamRole') }}</th>
            <th class="py-2 text-end font-semibold">{{ t('materials.columns.quantity') }}</th>
            <th class="py-2 text-end font-semibold">{{ t('materials.columns.stillHas') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="(row, index) in people" :key="row.user_id" class="border-b border-dl-line-soft" :class="(!row.can || !lines[row.user_id]?.on) && 'opacity-55'">
              <td class="py-2"><input v-if="row.can" v-model="lines[row.user_id]!.on" type="checkbox" class="h-4 w-4 accent-dl-ink" :aria-label="row.name"></td>
              <td class="py-2 font-semibold">{{ row.name }}<span v-if="lineError(index)" class="block text-xs font-normal text-dl-rejected">{{ lineError(index) }}</span></td>
              <td class="py-2 text-dl-muted">{{ [row.team, row.role ? roleLabel(row.role) : null].filter(Boolean).join(' · ') }}</td>
              <td class="py-2 text-end">
                <input v-if="row.can" v-model="lines[row.user_id]!.quantity" type="number" min="0" class="h-9 w-20 rounded-[10px] border border-dl-line bg-dl-paper px-2 text-end font-semibold" :aria-label="t('materials.columns.quantity')" :disabled="!lines[row.user_id]?.on">
                <span v-else class="text-xs text-dl-muted">{{ t('materials.distribute.noCycle') }}</span>
              </td>
              <td class="py-2 text-end"><span v-if="row.still_has" class="rounded-full bg-dl-cobalt/10 px-2 py-0.5 text-xs font-bold text-dl-cobalt">{{ n(row.still_has) }}</span><span v-else class="text-dl-muted">—</span></td>
            </tr>
          </tbody>
        </table>
      </section>
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-[12.5px] text-dl-muted">
        {{ t('materials.distribute.note') }}<template v-if="budget !== null"> {{ t('materials.distribute.budget', { count: n(total), cost: money(Number(form.unit_cost)), total: money(budget) }) }}</template>
      </p>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="material-distribute" variant="dark" class="ms-auto" :disabled="!ticked.length || !form.speciality_ids.length" :loading="saving">{{ t('materials.distribute.save', { count: n(total) }) }}</DlButton>
    </template>
  </DlSheet>
</template>
