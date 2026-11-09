<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { nearLimit, usageApi, type UsageOverview, type UsageRow } from '@/api/central/usage'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { sortRows } from '@/composables/sortRows'
import LabLogo from '../labs/LabLogo.vue'
import { dayFromToday, useLabTexts } from '../labs/useLabTexts'
import UsageMeter from './UsageMeter.vue'

/** What each lab uses in a month against its plan. A short list, all loaded: the page filters and sorts it. */
const { t, d, n } = useI18n()
const router = useRouter()
const { periodLabel, periodTone } = useLabTexts()

const usage = ref<UsageOverview | null>(null)
const error = ref<string | null>(null)
const month = ref('')
const search = ref('')
const plan = ref<string | number>('all')
const near = ref(false)
// The bell opens this page with ?near=1: only labs near or over a limit.
const route = useRoute()
watch(() => route.query.near, (value) => { near.value = value === '1' }, { immediate: true })
const sort = ref('name')

const GB = 1024 ** 3
const monthName = (value: string) => d(new Date(`${value}T12:00:00`), { month: 'long', year: 'numeric' })
const thisMonth = `${dayFromToday(0).slice(0, 7)}-01`
const isPast = computed(() => !!usage.value && usage.value.month !== thisMonth)
// This month always comes first, even before anything is counted.
const monthOptions = computed(() => [...new Set([thisMonth, ...(usage.value?.months ?? [])])]
  .map((value) => ({ value: value.slice(0, 7), label: monthName(value) })))
const planOptions = computed(() => {
  const plans = new Map((usage.value?.labs ?? []).filter((lab) => lab.plan).map((lab) => [lab.plan!.id, lab.plan!.name]))

  return [{ value: 'all', label: t('common.list.all') }, ...[...plans].map(([value, label]) => ({ value, label }))]
})
const rows = computed(() => {
  const text = search.value.trim().toLowerCase()
  const found = (usage.value?.labs ?? []).filter((lab) => [lab.name, lab.id].some((value) => value.toLowerCase().includes(text))
    && (plan.value === 'all' || lab.plan?.id === plan.value)
    && (!near.value || nearLimit(lab)))

  return sortRows(found, sort.value, {
    name: (lab) => lab.name,
    plan: (lab) => lab.plan?.name ?? '',
    period_status: (lab) => lab.period_status ?? '',
    accounts: (lab) => lab.accounts.value,
    signed_in: (lab) => lab.signed_in.value,
    emails: (lab) => lab.emails.value,
    storage: (lab) => lab.storage_bytes.value,
  })
})

async function load(): Promise<void> {
  error.value = null
  try {
    usage.value = await usageApi.overview(month.value || undefined)
    month.value = usage.value.month.slice(0, 7)
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}

onMounted(load)
watch(month, (now, before) => { if (before && now !== before) load() })

const open = (lab: UsageRow) => router.push({ name: 'central-lab', params: { id: lab.id }, query: { tab: 'usage' } })
// Tiles share the full width, however many currencies there are.
const tile = 'min-w-[180px] flex-1 rounded-[18px] bg-dl-paper px-4 py-3.5'
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.usage.title') }}</h1>
      <DlSelect v-model="month" :label="t('central.usage.month')" :options="monthOptions" appearance="filter" />
    </div>
    <DlAlert v-if="error">{{ error }}</DlAlert>

    <template v-if="usage">
      <!-- Lab counts are today's whatever the month; revenue follows the month. -->
      <div class="flex flex-wrap gap-3">
        <div :class="tile">
          <small class="block text-xs font-semibold text-dl-muted">{{ t('central.usage.labsActive') }}</small>
          <b class="mt-1 block font-display text-[28px] tabular-nums">{{ n(usage.totals.labs_active) }}</b>
          <em class="text-xs not-italic text-dl-body">{{ isPast ? t('central.usage.today') : t('central.usage.inTrialCount', { count: usage.totals.labs_trial }) }}</em>
        </div>
        <div :class="tile">
          <small class="block text-xs font-semibold text-dl-muted">{{ t('central.usage.labsSuspended') }}</small>
          <b class="mt-1 block font-display text-[28px] tabular-nums">{{ n(usage.totals.labs_suspended) }}</b>
          <em class="text-xs not-italic text-dl-body">{{ isPast ? t('central.usage.today') : t('central.usage.nothingDeleted') }}</em>
        </div>
        <div :class="tile">
          <small class="block text-xs font-semibold text-dl-muted">{{ t('central.usage.labsTrial') }}</small>
          <b class="mt-1 block font-display text-[28px] tabular-nums">{{ n(usage.totals.labs_trial) }}</b>
          <em class="text-xs not-italic text-dl-body">{{ isPast ? t('central.usage.today') : t('central.usage.endingSoon', { count: usage.totals.trials_ending_soon }) }}</em>
        </div>
        <div v-for="sum in usage.totals.revenue" :key="sum.currency" :class="tile">
          <small class="block text-xs font-semibold text-dl-muted">{{ t('central.usage.revenue') }}</small>
          <b class="mt-1 block font-display text-[28px] tabular-nums">{{ n(Number(sum.amount)) }}</b>
          <em class="text-xs not-italic text-dl-body">{{ t('central.usage.revenueHint', { currency: sum.currency, month: monthName(usage.month) }) }}</em>
        </div>
        <div v-if="!usage.totals.revenue.length" :class="tile">
          <small class="block text-xs font-semibold text-dl-muted">{{ t('central.usage.revenue') }}</small>
          <b class="mt-1 block font-display text-[28px] tabular-nums">0</b>
          <em class="text-xs not-italic text-dl-body">{{ t('central.usage.noPaid') }}</em>
        </div>
      </div>

      <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2.5">
          <DlInput v-model="search" :label="t('central.labs.search')" :placeholder="t('central.labs.search')" hide-label icon="tabler-search" class="w-full sm:w-60" />
          <DlSelect v-model="plan" :label="t('central.labs.plan')" :options="planOptions" appearance="filter" />
          <DlSwitch v-model="near" :label="t('central.usage.nearLimit')" />
          <span class="ms-auto text-xs text-dl-muted">
            {{ usage.measured_at ? t('central.usage.measuredAt', { date: d(new Date(usage.measured_at), { dateStyle: 'medium', timeStyle: 'short' }) }) : t('central.usage.notMeasured') }}
          </span>
        </div>

        <DlEmptyState v-if="!rows.length" :title="t('central.labs.noMatch')" icon="tabler-chart-bar" />
        <table v-else class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-dl-line text-xs text-dl-muted">
              <DlSortHeader v-model="sort" column="name" :label="t('central.labs.lab')" />
              <DlSortHeader v-model="sort" column="plan" :label="t('central.labs.plan')" class="hidden md:table-cell" />
              <DlSortHeader v-model="sort" column="period_status" :label="t('central.labs.periodLabel')" class="hidden lg:table-cell" />
              <DlSortHeader v-model="sort" column="accounts" :label="t('central.usage.accounts')" />
              <DlSortHeader v-model="sort" column="signed_in" :label="t('central.usage.signedIn')" />
              <DlSortHeader v-model="sort" column="emails" :label="t('central.usage.emails')" />
              <DlSortHeader v-model="sort" column="storage" :label="t('central.usage.storage')" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="lab in rows" :key="lab.id" class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft" tabindex="0" @click="open(lab)" @keydown.enter="open(lab)">
              <td class="p-3"><div class="flex items-center gap-2.5"><LabLogo :name="lab.name" :url="lab.logo_url" /><strong>{{ lab.name }}</strong></div></td>
              <td class="hidden p-3 md:table-cell">{{ lab.plan?.name ?? '—' }}</td>
              <td class="hidden p-3 lg:table-cell"><DlBadge :tone="periodTone(lab.period_status)" dot size="sm">{{ periodLabel(lab.period_status) }}</DlBadge></td>
              <td class="p-3"><UsageMeter :value="lab.accounts.value" :limit="lab.accounts.limit" /></td>
              <td class="p-3 font-semibold tabular-nums">{{ n(lab.signed_in.value) }}</td>
              <td class="p-3"><UsageMeter :value="lab.emails.value" :limit="lab.emails.limit" /></td>
              <td class="p-3"><UsageMeter :value="lab.storage_bytes.value / GB" :limit="lab.storage_bytes.limit_gb" unit="GB" :decimals="1" /></td>
            </tr>
          </tbody>
        </table>
        <p class="pt-2.5 text-xs text-dl-muted">{{ t('central.usage.rule') }}</p>
      </div>
    </template>
  </div>
</template>
