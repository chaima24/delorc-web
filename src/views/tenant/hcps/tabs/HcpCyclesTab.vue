<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchHcpCycles, type HcpCycleRow } from '@/api/tenant/cycles'
import type { Hcp } from '@/api/tenant/hcps'
import DlBadge from '@/components/DlBadge.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlPagination from '@/components/DlPagination.vue'
import { STATE_TONE, useCycleText } from '@/views/tenant/cycles/cycleDisplay'

// The cycles this professional is in (newest first): whose cycle, period, segment, visits to do,
// done and planned there (with visits). A row opens the cycle.
const props = defineProps<{ hcp: Hcp }>()
const { t, n } = useI18n()
const router = useRouter()
const text = useCycleText()

const rows = shallowRef<HcpCycleRow[]>([])
const total = ref(0)
const page = ref(1)
const perPage = ref(10)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const body = await fetchHcpCycles(props.hcp.id, { page: page.value, per_page: perPage.value })
    rows.value = body.data
    total.value = body.meta.total
  }
  catch {
    rows.value = []
  }
  finally {
    loading.value = false
  }
}
watch([() => props.hcp.id, page, perPage], load, { immediate: true })

const columns = [
  { key: 'period', label: t('hcps.cycles.dates') },
  { key: 'rep', label: t('hcps.visits.rep') },
  { key: 'segment', label: t('hcps.cycles.segment') },
  { key: 'visits', label: t('cycles.pros.toDo'), align: 'end' as const },
]
const open = (row: HcpCycleRow) => router.push({ name: 'tenant-cycle-detail', params: { id: row.cycle.id } })
</script>

<template>
  <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
    <DlDataList
      :label="t('hcps.tabs.cycles')"
      :columns="columns"
      :rows="rows"
      :row-key="row => row.id"
      :loading="loading"
      :empty-title="t('hcps.cycles.empty')"
      @open="open"
    >
      <template #cell-period="{ row }">
        <span class="flex flex-wrap items-center gap-2">
          <strong class="whitespace-nowrap font-semibold">{{ text.period(row.cycle.start_date, row.cycle.end_date) }}</strong>
          <DlBadge v-if="row.cycle.state !== 'ended'" size="sm" :tone="STATE_TONE[row.cycle.state]">{{ text.state(row.cycle.state, row.cycle.start_date) }}</DlBadge>
        </span>
      </template>
      <template #cell-rep="{ row }">{{ row.cycle.user?.full_name ?? '—' }}</template>
      <template #cell-segment="{ row }">
        <span v-if="row.segment" class="inline-flex items-center gap-1.5 font-semibold"><i class="h-[9px] w-[9px] rounded-[3px]" :style="{ background: row.segment.color ?? undefined }" />{{ row.segment.name }}</span>
        <span v-else class="text-dl-pending">{{ t('cycles.segment.none') }}</span>
      </template>
      <template #cell-visits="{ row }"><span class="tabular-nums">{{ row.to_do ? n(row.to_do) : '—' }}</span></template>
      <template #card="{ row }">
        <span class="flex min-w-0 flex-col">
          <strong class="font-semibold">{{ text.period(row.cycle.start_date, row.cycle.end_date) }}</strong>
          <span class="truncate text-xs text-dl-muted">{{ [row.cycle.user?.full_name, row.segment?.name ?? t('cycles.segment.none'), t('hcps.cycles.toDo', { n: row.to_do ? n(row.to_do) : '—' })].join(' · ') }}</span>
        </span>
      </template>
    </DlDataList>
    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
  </section>
</template>
