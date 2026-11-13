<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { fetchCycles, type CycleListItem } from '@/api/tenant/cycles'
import type { TenantUser } from '@/api/tenant/users'
import DlBadge from '@/components/DlBadge.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { STATE_TONE, useCycleText } from '@/views/tenant/cycles/cycleDisplay'

// The person's cycles, newest first, with their live figures (goal from the objective × field days).
// A row opens the cycle page. Coverage and pace come with visits.
const props = defineProps<{ user: TenantUser }>()
const { t, n } = useI18n()
const text = useCycleText()

const cycles = ref<CycleListItem[]>([])
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    cycles.value = (await fetchCycles({ 'filter[user_id]': props.user.id, figures: 1, sort: '-start_date', per_page: 24 })).data
  }
  finally {
    loading.value = false
  }
}
watch(() => props.user.id, load, { immediate: true })
</script>

<template>
  <section class="rounded-2xl border border-dl-line bg-dl-paper px-3.5 py-3">
    <div v-if="loading" class="flex flex-col gap-2"><DlSkeleton v-for="i in 3" :key="i" class="h-12 rounded-xl" /></div>
    <p v-else-if="!cycles.length" class="text-[13px] text-dl-muted">{{ t('users.cycles.none') }}</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr class="text-xs text-dl-muted">
            <th class="py-2 pe-3 text-start font-semibold">{{ t('users.cycles.dates') }}</th>
            <th class="py-2 pe-3 text-end font-semibold">{{ t('cycles.columns.professionals') }}</th>
            <th class="py-2 pe-3 text-start font-semibold">{{ t('cycles.columns.coverage') }}</th>
            <th class="py-2 pe-3 text-start font-semibold">{{ t('cycles.columns.visits') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cycle in cycles" :key="cycle.id" class="border-t border-dl-line-soft">
            <td class="py-2.5 pe-3">
              <span class="flex flex-wrap items-center gap-2">
                <RouterLink :to="{ name: 'tenant-cycle-detail', params: { id: cycle.id } }" class="font-semibold text-dl-fg no-underline hover:underline">{{ text.period(cycle.start_date, cycle.end_date) }}</RouterLink>
                <DlBadge v-if="cycle.figures" size="sm" :tone="STATE_TONE[cycle.figures.state]">{{ text.state(cycle.figures.state, cycle.start_date) }}</DlBadge>
              </span>
            </td>
            <td class="py-2.5 pe-3 text-end tabular-nums">{{ n(cycle.figures?.professionals ?? 0) }}</td>
            <td class="py-2.5 pe-3 text-dl-muted">{{ t('cycles.laterVisits') }}</td>
            <td class="py-2.5 pe-3">
              <span v-if="cycle.figures" class="text-dl-muted">{{ t('cycles.board.goal', { n: n(cycle.figures.goal_visits) }) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-dl-muted">{{ t('users.cycles.hint') }}</p>
  </section>
</template>
