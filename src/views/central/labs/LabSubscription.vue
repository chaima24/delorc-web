<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Lab, Subscription } from '@/api/central/labs'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { sortRows } from '@/composables/sortRows'
import { useAuthStore } from '@/stores/auth'
import PeriodPanel from './PeriodPanel.vue'
import { dayFromToday, useLabTexts } from './useLabTexts'

const props = defineProps<{ lab: Lab }>()
const emit = defineEmits<{ changed: [lab: Lab] }>()

const { t, d } = useI18n()
const auth = useAuthStore()
const { day, money, periodLabel, periodTone } = useLabTexts()

const sort = ref('-starts_on')
/** `new` adds a period; a period opens it to edit its price and note. */
const panel = ref<'new' | Subscription | null>(null)
const panelOpen = computed({ get: () => panel.value !== null, set: (open) => { if (!open) panel.value = null } })
const canChange = computed(() => auth.can('labs.update-plan'))

const current = computed(() => props.lab.subscriptions.find(({ is_current }) => is_current) ?? null)
/** Days left in the current period, today included. */
const daysLeft = computed(() => (current.value
  ? Math.round((new Date(`${current.value.ends_on}T12:00:00`).getTime() - new Date(`${dayFromToday(0)}T12:00:00`).getTime()) / 86_400_000) + 1
  : 0))

const periods = computed(() => sortRows(props.lab.subscriptions, sort.value, {
  plan: (period) => period.plan.name,
  kind: (period) => period.kind,
  starts_on: (period) => period.starts_on,
  ends_on: (period) => period.ends_on,
  monthly_price: (period) => Number(period.monthly_price),
  note: (period) => period.note ?? '',
  created_by: (period) => period.created_by?.name ?? '',
  created_at: (period) => period.created_at,
}))

function changed(lab: Lab): void {
  panel.value = null
  emit('changed', lab)
}

const openPeriod = (period: Subscription) => { if (canChange.value) panel.value = period }
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex items-center gap-4 rounded-3xl bg-dl-paper p-[18px]">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-dl-muted">{{ t('central.labs.currentPeriod') }}</p>
          <template v-if="current">
            <p class="font-display text-[22px] font-extrabold">{{ current.plan.name }} · {{ periodLabel(current.kind) }}</p>
            <p class="text-[13px] text-dl-muted">{{ day(current.starts_on) }} → {{ day(current.ends_on) }} · {{ t('central.labs.daysLeft', { count: daysLeft }) }}</p>
          </template>
          <template v-else>
            <p class="font-display text-[22px] font-extrabold">{{ t('central.labs.noCurrentPeriod') }}</p>
            <p v-if="lab.subscriptions[0]" class="text-[13px] text-dl-muted">{{ t('central.labs.lastPeriod', { plan: lab.subscriptions[0].plan.name, date: day(lab.subscriptions[0].ends_on) }) }}</p>
          </template>
        </div>
        <DlBadge :tone="periodTone(lab.period_status)" dot>{{ periodLabel(lab.period_status) }}</DlBadge>
      </div>

      <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
        <div class="mb-3 flex items-center gap-2.5">
          <h2 class="flex-1 text-[15px] font-bold">{{ t('central.labs.periods') }}</h2>
          <DlButton v-if="canChange" variant="primary" size="sm" icon="tabler-plus" @click="panel = 'new'">{{ t('central.labs.addPeriod') }}</DlButton>
        </div>
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-dl-line text-xs text-dl-muted">
              <DlSortHeader v-model="sort" column="plan" :label="t('central.labs.plan')" />
              <DlSortHeader v-model="sort" column="kind" :label="t('central.labs.kind')" />
              <DlSortHeader v-model="sort" column="starts_on" :label="t('central.labs.startsOn')" />
              <DlSortHeader v-model="sort" column="ends_on" :label="t('central.labs.endsOn')" />
              <DlSortHeader v-model="sort" column="monthly_price" :label="t('central.labs.price')" />
              <DlSortHeader v-model="sort" column="note" :label="t('central.labs.note')" class="hidden md:table-cell" />
              <DlSortHeader v-model="sort" column="created_by" :label="t('central.labs.addedBy')" class="hidden lg:table-cell" />
              <DlSortHeader v-model="sort" column="created_at" :label="t('common.list.createdAt')" class="hidden lg:table-cell" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="period in periods"
              :key="period.id"
              class="border-b border-dl-line-soft"
              :class="[canChange && 'cursor-pointer hover:bg-dl-line-soft', panel !== 'new' && panel?.id === period.id && 'bg-dl-signal-soft']"
              :tabindex="canChange ? 0 : undefined"
              @click="openPeriod(period)"
              @keydown.enter="openPeriod(period)"
            >
              <td class="p-3 font-semibold">{{ period.plan.name }}</td>
              <td class="p-3"><DlBadge :tone="periodTone(period.kind)" size="sm">{{ periodLabel(period.kind) }}</DlBadge></td>
              <td class="p-3 tabular-nums">{{ day(period.starts_on) }}</td>
              <td class="p-3 tabular-nums">{{ day(period.ends_on) }}</td>
              <td class="p-3 tabular-nums">{{ money(period.monthly_price, period.currency) }}</td>
              <td class="hidden p-3 text-[13px] md:table-cell">{{ period.note ?? '—' }}</td>
              <td class="hidden p-3 text-[13px] text-dl-muted lg:table-cell">{{ period.created_by?.name ?? t('central.activity.system') }}</td>
              <td class="hidden p-3 text-[13px] text-dl-muted lg:table-cell">{{ d(new Date(period.created_at)) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="pt-2.5 text-xs text-dl-muted">{{ t('central.labs.pricesHint') }}</p>
      </div>
    </div>

    <PeriodPanel v-if="panel" :key="panel === 'new' ? 'new' : panel.id" v-model:open="panelOpen" :lab="lab" :period="panel === 'new' ? undefined : panel" @changed="changed" />
  </div>
</template>
