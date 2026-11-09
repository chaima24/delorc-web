<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { plansApi, type Feature, type FeatureValue, type Plan, type ValueToSave } from '@/api/central/plans'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { sortRows } from '@/composables/sortRows'
import { useAuthStore } from '@/stores/auth'
import NewPlanPanel from './NewPlanPanel.vue'
import PlanPanel from './PlanPanel.vue'
import { usePlanTexts } from './usePlanTexts'

const { t, n, d } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const { featureName, featureDescription, price } = usePlanTexts()

const features = ref<Feature[]>([])
const plans = ref<Plan[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showInactive = ref(false)
const sort = ref('monthly_price')
const selectedId = ref<number | null>(null)
const adding = ref(false)

/**
 * Edit mode: what was typed, by "planId|feature". A limit keeps the text of its box until the save,
 * so a wrong entry reaches the API and comes back as that cell's error.
 */
const editing = ref(false)
const edits = ref<Record<string, string | boolean>>({})
const cellErrors = ref<Record<string, string>>({})
const saving = ref(false)

const canEdit = computed(() => auth.can('plans.update'))
const selected = computed(() => plans.value.find(({ id }) => id === selectedId.value) ?? null)
const panelOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selectedId.value = null
  },
})
const changes = computed(() => Object.keys(edits.value).length)
const limits = computed(() => features.value.filter(({ type }) => type === 'limit'))
const switches = computed(() => features.value.filter(({ type }) => type === 'switch'))

const sortOptions = computed(() => [
  { value: 'monthly_price', label: t('central.plans.sort.price') },
  { value: 'name', label: t('central.plans.sort.name') },
  { value: '-labs_count', label: t('central.plans.sort.labs') },
  { value: '-created_at', label: t('central.plans.sort.newest') },
])

// Few plans, all loaded: the page filters and sorts them itself.
const shown = computed(() => {
  const found = plans.value.filter((plan) => showInactive.value || plan.is_active)

  return sortRows(found, sort.value, {
    monthly_price: (plan) => Number(plan.monthly_price),
    name: (plan) => plan.name,
    labs_count: (plan) => plan.labs_count,
    created_at: (plan) => plan.created_at,
  })
})

async function load(): Promise<void> {
  error.value = null
  try {
    ;[features.value, plans.value] = await Promise.all([plansApi.features(), plansApi.list()])
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  // The activity log links here with ?open={id}.
  const opened = plans.value.find(({ id }) => String(id) === route.query.open)
  if (opened) {
    showInactive.value = !opened.is_active
    selectedId.value = opened.id
  }
})

const cellKey = (plan: Plan, feature: Feature) => `${plan.id}|${feature.key}`
const isDefault = (plan: Plan, feature: Feature) => plan.defaults.includes(feature.key)

function limitText(value: FeatureValue): string {
  if (value === null) return t('central.plans.unlimited')
  if (value === 0) return t('central.plans.none')

  return n(Number(value))
}

/** What a limit's box shows: the typed text, or the saved number. Empty means unlimited. */
function boxText(plan: Plan, feature: Feature): string {
  const typed = edits.value[cellKey(plan, feature)]
  if (typeof typed === 'string') return typed
  const value = plan.values[feature.key]

  return value === null || value === undefined ? '' : String(value)
}

const switchOn = (plan: Plan, feature: Feature) => Boolean(edits.value[cellKey(plan, feature)] ?? plan.values[feature.key])

function setCell(plan: Plan, feature: Feature, typed: string | boolean): void {
  const key = cellKey(plan, feature)
  const saved = plan.values[feature.key]
  const unchanged = typeof typed === 'boolean'
    ? typed === saved && !isDefault(plan, feature)
    : typed.trim() === (saved === null ? '' : String(saved)) && !isDefault(plan, feature)
  const others = { ...edits.value }
  delete others[key]
  edits.value = unchanged ? others : { ...others, [key]: typed }
  delete cellErrors.value[key]
}

function startEditing(): void {
  selectedId.value = null
  adding.value = false
  editing.value = true
}

function stopEditing(): void {
  edits.value = {}
  cellErrors.value = {}
  editing.value = false
}

/** An empty box is unlimited; whole numbers are sent as numbers; anything else is sent as typed, so the API names it. */
function toValue(typed: string | boolean): FeatureValue | string {
  if (typeof typed === 'boolean') return typed
  const text = typed.trim()
  if (text === '') return null

  return /^\d+$/.test(text) ? Number(text) : text
}

async function save(): Promise<void> {
  const keys = Object.keys(edits.value)
  const values = keys.map((key) => {
    const [planId = '', feature = ''] = key.split('|')

    return { plan_id: Number(planId), feature, value: toValue(edits.value[key] ?? '') }
  })
  saving.value = true
  cellErrors.value = {}
  error.value = null
  try {
    await plansApi.saveValues(values as ValueToSave[])
    stopEditing()
    await load()
  } catch (failure) {
    const fields = fieldErrors(failure)
    cellErrors.value = Object.fromEntries(keys.flatMap((key, index) => {
      const message = fields[`values.${index}.value`] ?? fields[`values.${index}.feature`]

      return message ? [[key, message]] : []
    }))
    if (!Object.keys(cellErrors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    saving.value = false
  }
}

function open(plan: Plan): void {
  if (editing.value) return
  adding.value = false
  selectedId.value = plan.id
}

function startAdding(): void {
  selectedId.value = null
  adding.value = true
}

async function onAdded(plan: Plan): Promise<void> {
  adding.value = false
  await load()
  selectedId.value = plan.id
}

function onDeleted(): void {
  selectedId.value = null
  load()
}
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex items-end justify-between gap-3">
        <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.plans.title') }}</h1>
        <div v-if="!editing" class="flex gap-2">
          <DlButton v-if="canEdit && plans.length" variant="outline" @click="startEditing">{{ t('central.plans.editValues') }}</DlButton>
          <DlButton v-if="auth.can('plans.create')" variant="primary" icon="tabler-plus" @click="startAdding">{{ t('central.plans.add') }}</DlButton>
        </div>
      </div>
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <DlEmptyState v-if="!loading && !plans.length" :title="t('central.plans.empty')" :description="t('central.plans.emptyHint', { count: features.length })" icon="tabler-stack-2" />

      <div v-else-if="!loading" class="rounded-3xl bg-dl-paper p-4">
        <div class="mb-2 flex flex-wrap items-center gap-2.5">
          <DlSelect v-model="sort" :label="t('central.plans.sort.label')" :options="sortOptions" appearance="filter" />
          <DlSwitch v-model="showInactive" :label="t('central.plans.showInactive')" />
          <span class="ms-auto text-xs text-dl-muted">{{ t('central.plans.limitHint') }}</span>
        </div>

        <DlEmptyState v-if="!shown.length" :title="t('central.plans.noneActive')" :description="t('central.plans.noneActiveHint')" icon="tabler-stack-2" />
        <div v-else class="overflow-x-auto">
          <table class="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th class="border-b border-dl-line p-3.5 text-start align-top text-xs font-semibold text-dl-muted">{{ t('central.plans.feature') }}</th>
                <th
                  v-for="plan in shown"
                  :key="plan.id"
                  class="w-44 min-w-40 border-b border-dl-line p-3.5 text-start align-top font-normal"
                  :class="[selected?.id === plan.id && 'bg-dl-signal-soft', !plan.is_active && 'text-dl-muted']"
                >
                  <button
                    type="button"
                    class="w-full text-start focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt disabled:cursor-default"
                    :disabled="editing"
                    @click="open(plan)"
                  >
                    <span class="flex items-center gap-1.5 font-display text-[19px] font-extrabold" :class="plan.is_active ? 'text-dl-ink' : 'text-dl-muted'">
                      {{ plan.name }}
                      <DlBadge v-if="!plan.is_active" tone="neutral" size="sm">{{ t('central.plans.status.inactive') }}</DlBadge>
                    </span>
                    <span class="mt-1 block text-[13px] font-semibold tabular-nums text-dl-body">{{ price(plan) }} <span class="text-xs font-medium text-dl-muted">{{ t('central.plans.perMonth') }}</span></span>
                    <span class="mt-0.5 block text-xs text-dl-muted">{{ t('central.plans.labsCount', { count: plan.labs_count }) }} · {{ t('central.plans.addedOn', { date: d(new Date(plan.created_at)) }) }}</span>
                    <span v-if="!editing" class="mt-1.5 block text-xs font-semibold text-dl-ink">{{ t('central.plans.details') }} ›</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="group in [{ name: 'limits', rows: limits }, { name: 'included', rows: switches }]" :key="group.name">
                <tr v-if="group.rows.length">
                  <td :colspan="shown.length + 1" class="px-3.5 pb-1.5 pt-3.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-dl-muted">{{ t(`central.plans.group.${group.name}`) }}</td>
                </tr>
                <tr v-for="feature in group.rows" :key="feature.key">
                  <td class="border-b border-dl-line-soft p-3.5">
                    <span class="block font-semibold text-dl-ink">{{ featureName(feature.key) }}</span>
                    <span class="mt-0.5 block max-w-[330px] text-xs text-dl-muted">{{ featureDescription(feature.key) }}</span>
                  </td>
                  <td
                    v-for="plan in shown"
                    :key="plan.id"
                    class="border-b border-dl-line-soft p-3.5"
                    :class="[selected?.id === plan.id && 'bg-dl-signal-soft', !plan.is_active && 'text-dl-muted']"
                  >
                    <template v-if="editing">
                      <template v-if="feature.type === 'limit'">
                        <input
                          :value="boxText(plan, feature)"
                          :aria-label="`${plan.name}: ${featureName(feature.key)}`"
                          :placeholder="t('central.plans.unlimited')"
                          inputmode="numeric"
                          class="h-9 w-full rounded-[10px] border bg-dl-paper px-2.5 text-sm tabular-nums outline-hidden placeholder:text-dl-muted focus-visible:ring-2 focus-visible:ring-dl-cobalt"
                          :class="cellErrors[cellKey(plan, feature)] ? 'border-dl-rejected' : cellKey(plan, feature) in edits ? 'border-dl-ink' : 'border-dl-line'"
                          @input="setCell(plan, feature, ($event.target as HTMLInputElement).value)"
                        >
                      </template>
                      <DlSwitch
                        v-else
                        :model-value="switchOn(plan, feature)"
                        :label="t(switchOn(plan, feature) ? 'central.plans.included' : 'central.plans.notIncluded')"
                        @update:model-value="setCell(plan, feature, $event)"
                      />
                      <p v-if="cellErrors[cellKey(plan, feature)]" class="mt-1 text-[11.5px] text-dl-rejected">{{ cellErrors[cellKey(plan, feature)] }}</p>
                    </template>
                    <span v-else-if="isDefault(plan, feature)" class="text-[13px] italic text-dl-muted">
                      {{ t('central.plans.default', { value: feature.type === 'limit' ? limitText(feature.default) : t(feature.default ? 'central.plans.on' : 'central.plans.off') }) }}
                    </span>
                    <template v-else-if="feature.type === 'limit'">
                      <span class="font-semibold tabular-nums" :class="plan.values[feature.key] === 0 ? 'font-normal text-dl-muted' : ''">{{ limitText(plan.values[feature.key] ?? null) }}</span>
                    </template>
                    <span v-else-if="plan.values[feature.key]" class="font-semibold text-dl-ink">✓ {{ t('central.plans.included') }}</span>
                    <span v-else class="text-dl-muted">—</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div v-if="editing" class="sticky bottom-3 mt-3 flex items-center gap-3 rounded-[18px] bg-dl-ink py-2.5 pe-3 ps-[18px] text-sm text-dl-on-ink">
          <span class="flex-1">
            <b>{{ t('central.plans.changes', { count: n(changes) }) }}</b>
            <small class="block text-[12.5px] text-dl-on-ink-muted">{{ t('central.plans.changesHint') }}</small>
          </span>
          <DlButton variant="ghost" size="sm" class="text-dl-on-ink! hover:bg-dl-ink-2!" @click="stopEditing">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton variant="primary" size="sm" :loading="saving" :disabled="!changes" @click="save">{{ t('common.actions.save') }}</DlButton>
        </div>
      </div>
    </div>

    <PlanPanel v-if="selected" v-model:open="panelOpen" :plan="selected" @changed="load" @deleted="onDeleted" />
    <NewPlanPanel v-if="adding" v-model:open="adding" :plans="plans" @added="onAdded" />
  </div>
</template>
