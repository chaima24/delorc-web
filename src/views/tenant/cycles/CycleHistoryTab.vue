<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchCycleHistory, type CycleDetail, type CycleHistoryRow } from '@/api/tenant/cycles'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useUserText } from '@/views/tenant/users/userDisplay'
import { useCycleText } from './cycleDisplay'

// What happened to the cycle, newest first: created and filled, professionals added or removed,
// segments changed, dates changed.
const props = defineProps<{ cycle: CycleDetail }>()
const { t, n } = useI18n()
const text = useCycleText()
const userText = useUserText()

const rows = ref<CycleHistoryRow[]>([])
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    rows.value = await fetchCycleHistory(props.cycle.id)
  }
  finally {
    loading.value = false
  }
}
// Reloaded when the cycle changes (dates, list): the parent passes a fresh object.
watch(() => props.cycle, load, { immediate: true })

const ICONS: Record<CycleHistoryRow['event'], string> = {
  created: 'tabler-sparkles',
  filled: 'tabler-list-check',
  professionals_added: 'tabler-user-plus',
  professionals_removed: 'tabler-user-minus',
  segment_changed: 'tabler-chart-pie',
  dates_changed: 'tabler-calendar',
}

function line(row: CycleHistoryRow) {
  const p = row.properties
  const count = p.count ?? 0
  switch (row.event) {
    case 'filled':
      return t(`cycles.history.filled.${p.fill ?? 'none'}`, { n: n(count), last: n(p.from_last ?? 0), new: n(p.new_in_territory ?? 0) }, count)
    case 'professionals_added':
      return t('cycles.history.added', { n: n(count), segment: p.segment ?? t('cycles.segment.none') }, count)
    case 'professionals_removed':
      return t('cycles.history.removed', { n: n(count) }, count)
    case 'segment_changed':
      return t('cycles.history.segment', { n: n(count), segment: p.segment ?? t('cycles.segment.none') }, count)
    case 'dates_changed': {
      const parts = []
      if (p.to?.[0]) parts.push(t('cycles.history.start', { from: p.from?.[0] ? text.day(p.from[0]) : '—', to: text.day(p.to[0]) }))
      if (p.to?.[1]) parts.push(t('cycles.history.end', { from: p.from?.[1] ? text.day(p.from[1]) : '—', to: text.day(p.to[1]) }))
      return parts.join(' · ')
    }
    default:
      return t('cycles.history.created')
  }
}
</script>

<template>
  <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
    <div v-if="loading && !rows.length" class="flex flex-col gap-2"><DlSkeleton v-for="i in 3" :key="i" class="h-12 rounded-xl" /></div>
    <p v-else-if="!rows.length" class="py-8 text-center text-sm text-dl-muted">{{ t('cycles.history.empty') }}</p>
    <ol v-else class="flex flex-col">
      <li v-for="row in rows" :key="row.id" class="flex gap-3 border-b border-dl-line-soft py-3 last:border-0">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-dl-mist text-dl-body"><DlIcon :icon="ICONS[row.event]" :size="16" /></span>
        <span class="min-w-0 text-[13px]">
          <span class="block">{{ line(row) }}</span>
          <small v-if="row.properties.names?.length" class="block text-xs text-dl-muted">{{ row.properties.names.join(', ') }}<template v-if="(row.properties.count ?? 0) > row.properties.names.length">…</template></small>
          <small class="block text-xs text-dl-muted">{{ row.by?.full_name ?? '—' }} · {{ userText.dateTime(row.at) }}</small>
        </span>
      </li>
    </ol>
  </section>
</template>
