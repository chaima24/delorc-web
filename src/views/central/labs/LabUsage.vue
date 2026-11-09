<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import type { Lab } from '@/api/central/labs'
import { percentOf, usageApi, type Counted, type UsageMonth } from '@/api/central/usage'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import UsageMeter from '../usage/UsageMeter.vue'

/** The lab's usage: this month in four tiles, then its last 12 months (each with the limits it had). */
const props = defineProps<{ lab: Lab }>()

const { t, d, n } = useI18n()
const months = ref<UsageMonth[]>([])
const error = ref<string | null>(null)
const GB = 1024 ** 3
const now = computed(() => months.value[0])
const monthName = (value: string) => d(new Date(`${value}T12:00:00`), { month: 'long', year: 'numeric' })
const pair = (counted: Counted) => (counted.limit === null ? n(counted.value) : `${n(counted.value)} / ${n(counted.limit)}`)
const over = (counted: Counted) => (percentOf(counted.value, counted.limit) ?? 0) >= 100
const gb = (bytes: number) => n(bytes / GB, { maximumFractionDigits: 1 })

onMounted(async () => {
  try {
    months.value = await usageApi.lab(props.lab.id)
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
})
const tile = 'flex min-w-[220px] flex-1 flex-col gap-1 rounded-[18px] bg-dl-paper px-4 py-3.5'
</script>

<template>
  <div class="flex flex-col gap-4">
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <template v-if="now">
      <div class="flex flex-wrap gap-3">
        <div :class="tile">
          <small class="text-xs font-semibold text-dl-muted">{{ t('central.usage.accounts') }}</small>
          <UsageMeter :value="now.accounts.value" :limit="now.accounts.limit" />
          <span class="text-xs text-dl-muted">{{ t('central.usage.accountsHint') }}</span>
        </div>
        <div :class="tile">
          <small class="text-xs font-semibold text-dl-muted">{{ t('central.usage.signedInMonth') }}</small>
          <b class="font-display text-[22px] tabular-nums">{{ n(now.signed_in.value) }}</b>
          <span class="text-xs text-dl-muted">{{ t('central.usage.signedInHint') }}</span>
        </div>
        <div :class="tile">
          <small class="text-xs font-semibold text-dl-muted">{{ t('central.usage.emailsMonth') }}</small>
          <UsageMeter :value="now.emails.value" :limit="now.emails.limit" />
          <span class="text-xs text-dl-muted">{{ t('central.usage.emailsHint') }}</span>
        </div>
        <div :class="tile">
          <small class="text-xs font-semibold text-dl-muted">{{ t('central.usage.storage') }}</small>
          <UsageMeter :value="now.storage_bytes.value / GB" :limit="now.storage_bytes.limit_gb" unit="GB" :decimals="1" />
          <span class="text-xs text-dl-muted">{{ t('central.usage.storageHint') }}</span>
        </div>
      </div>

      <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
        <h2 class="mb-2 text-[15px] font-bold">{{ t('central.usage.lastMonths') }}</h2>
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-dl-line text-xs text-dl-muted">
              <th class="p-3 text-start font-semibold">{{ t('central.usage.month') }}</th>
              <th class="p-3 text-end font-semibold">{{ t('central.usage.accounts') }}</th>
              <th class="p-3 text-end font-semibold">{{ t('central.usage.signedIn') }}</th>
              <th class="p-3 text-end font-semibold">{{ t('central.usage.emails') }}</th>
              <th class="p-3 text-end font-semibold">{{ t('central.usage.storage') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in months" :key="row.month" class="border-b border-dl-line-soft">
              <td class="p-3 font-semibold">{{ monthName(row.month) }}</td>
              <td class="p-3 text-end tabular-nums">{{ pair(row.accounts) }} <DlBadge v-if="over(row.accounts)" tone="danger" size="sm">{{ t('central.usage.over') }}</DlBadge></td>
              <td class="p-3 text-end tabular-nums">{{ n(row.signed_in.value) }}</td>
              <td class="p-3 text-end tabular-nums">{{ pair(row.emails) }} <DlBadge v-if="over(row.emails)" tone="danger" size="sm">{{ t('central.usage.over') }}</DlBadge></td>
              <td class="p-3 text-end tabular-nums">{{ row.storage_bytes.limit_gb === null ? gb(row.storage_bytes.value) : `${gb(row.storage_bytes.value)} / ${n(row.storage_bytes.limit_gb)}` }}</td>
            </tr>
          </tbody>
        </table>
        <p class="pt-2.5 text-xs text-dl-muted">{{ t('central.usage.historyHint') }}</p>
      </div>
    </template>
  </div>
</template>
