<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { labsApi, type LabRow } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { sortRows } from '@/composables/sortRows'
import { useAuthStore } from '@/stores/auth'
import LabLogo from './LabLogo.vue'
import { dayFromToday, useLabTexts } from './useLabTexts'

const { t, d } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { day, periodLabel, periodTone, statusLabel } = useLabTexts()

const labs = ref<LabRow[]>([])
const loaded = ref(false)
const error = ref<string | null>(null)
const search = ref('')
const status = ref('all')
const plan = ref<string | number>('all')
const period = ref('all')
const endingSoon = ref(false)
const sort = ref('-created_at')

const all = computed(() => ({ value: 'all', label: t('common.list.all') }))
const statusOptions = computed(() => [all.value, ...['active', 'suspended'].map((value) => ({ value, label: statusLabel(value as 'active' | 'suspended') }))])
const periodOptions = computed(() => [all.value, ...['trial', 'paid', 'grace', 'ended'].map((value) => ({ value, label: periodLabel(value as 'trial') }))])
const planOptions = computed(() => {
  const plans = new Map(labs.value.filter((lab) => lab.plan).map((lab) => [lab.plan!.id, lab.plan!.name]))

  return [all.value, ...[...plans].map(([value, label]) => ({ value, label }))]
})

// A short list, all loaded: the page searches, filters and sorts it itself.
const shown = computed(() => {
  const text = search.value.trim().toLowerCase()
  const limit = dayFromToday(30)
  const found = labs.value.filter((lab) => [lab.name, lab.id].some((value) => value.toLowerCase().includes(text))
    && (status.value === 'all' || lab.status === status.value)
    && (plan.value === 'all' || lab.plan?.id === plan.value)
    && (period.value === 'all' || lab.period_status === period.value)
    && (!endingSoon.value || (lab.period_ends_on !== null && lab.period_ends_on >= dayFromToday(0) && lab.period_ends_on <= limit)))

  return sortRows(found, sort.value, {
    name: (lab) => lab.name,
    id: (lab) => lab.id,
    country: (lab) => lab.country?.name ?? '',
    plan: (lab) => lab.plan?.name ?? '',
    period_status: (lab) => lab.period_status ?? '',
    period_ends_on: (lab) => lab.period_ends_on ?? '',
    status: (lab) => lab.status,
    created_at: (lab) => lab.created_at,
  })
})

onMounted(async () => {
  try {
    labs.value = await labsApi.list()
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    loaded.value = true
  }
})

const open = (lab: LabRow) => router.push({ name: 'central-lab', params: { id: lab.id } })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.labs.title') }}</h1>
      <DlButton v-if="auth.can('labs.create')" variant="primary" icon="tabler-plus" :to="{ name: 'central-lab-new' }">{{ t('central.labs.add') }}</DlButton>
    </div>
    <DlAlert v-if="error">{{ error }}</DlAlert>

    <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
      <DlEmptyState v-if="loaded && !labs.length" :title="t('central.labs.none')" :description="t('central.labs.noneHint')" icon="tabler-building-factory-2" />
      <template v-else>
        <div class="mb-3 flex flex-wrap items-center gap-2.5">
          <DlInput v-model="search" :label="t('central.labs.search')" :placeholder="t('central.labs.search')" hide-label icon="tabler-search" class="w-full sm:w-60" />
          <DlSelect v-model="status" :label="t('central.labs.statusLabel')" :options="statusOptions" appearance="filter" />
          <DlSelect v-model="plan" :label="t('central.labs.plan')" :options="planOptions" appearance="filter" />
          <DlSelect v-model="period" :label="t('central.labs.periodLabel')" :options="periodOptions" appearance="filter" />
          <DlSwitch v-model="endingSoon" :label="t('central.labs.endingSoon')" />
        </div>

        <DlEmptyState v-if="loaded && !shown.length" :title="t('central.labs.noMatch')" icon="tabler-building-factory-2" />
        <table v-else class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-dl-line text-xs text-dl-muted">
              <DlSortHeader v-model="sort" column="name" :label="t('central.labs.lab')" />
              <DlSortHeader v-model="sort" column="id" :label="t('central.labs.slug')" class="hidden md:table-cell" />
              <DlSortHeader v-model="sort" column="country" :label="t('central.labs.country')" class="hidden lg:table-cell" />
              <DlSortHeader v-model="sort" column="plan" :label="t('central.labs.plan')" />
              <DlSortHeader v-model="sort" column="period_status" :label="t('central.labs.periodLabel')" />
              <DlSortHeader v-model="sort" column="period_ends_on" :label="t('central.labs.endsOn')" class="hidden md:table-cell" />
              <DlSortHeader v-model="sort" column="status" :label="t('central.labs.statusLabel')" />
              <DlSortHeader v-model="sort" column="created_at" :label="t('common.list.createdAt')" class="hidden lg:table-cell" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="lab in shown"
              :key="lab.id"
              class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft"
              tabindex="0"
              @click="open(lab)"
              @keydown.enter="open(lab)"
            >
              <td class="p-3"><div class="flex items-center gap-2.5"><LabLogo :name="lab.name" :url="lab.logo_url" /><strong>{{ lab.name }}</strong></div></td>
              <td class="hidden p-3 text-[13px] text-dl-muted md:table-cell">{{ lab.id }}</td>
              <td class="hidden p-3 lg:table-cell">{{ lab.country?.name ?? '—' }}</td>
              <td class="p-3">{{ lab.plan?.name ?? '—' }}</td>
              <td class="p-3"><DlBadge :tone="periodTone(lab.period_status)" dot>{{ periodLabel(lab.period_status) }}</DlBadge></td>
              <td class="hidden p-3 tabular-nums md:table-cell">{{ day(lab.period_ends_on) }}</td>
              <td class="p-3"><DlBadge :tone="lab.status === 'active' ? 'success' : 'warning'" dot>{{ statusLabel(lab.status) }}</DlBadge></td>
              <td class="hidden p-3 text-[13px] text-dl-muted lg:table-cell">{{ d(new Date(lab.created_at)) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>
  </div>
</template>
