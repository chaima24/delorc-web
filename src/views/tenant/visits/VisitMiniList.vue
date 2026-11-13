<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchVisits, type Visit } from '@/api/tenant/visits'
import DlBadge from '@/components/DlBadge.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useVisitText } from './visitDisplay'

// The Visites tab of a cycle or of a professional: their visits, newest first; a line opens the visit's page.
// `filter` is the API filter that scopes it: `{ 'filter[cycle_id]': 55 }`, `{ 'filter[hcp_id]': 340 }`.
const props = defineProps<{ filter: Record<string, number>; showTarget?: boolean }>()
const { t } = useI18n()
const text = useVisitText()
const rows = ref<Visit[]>([])
const total = ref(0)
const page = ref(1)
const perPage = ref(10)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const result = await fetchVisits({ ...props.filter, page: page.value, per_page: perPage.value })
    rows.value = result.items
    total.value = result.total
  }
  finally {
    loading.value = false
  }
}
watch([() => JSON.stringify(props.filter), page, perPage], load, { immediate: true })
</script>

<template>
  <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
    <div v-if="loading" class="flex flex-col gap-2"><DlSkeleton v-for="i in 3" :key="i" class="h-10 rounded-xl" /></div>
    <p v-else-if="!rows.length" class="py-4 text-center text-sm text-dl-muted">{{ t('visits.empty.title') }}</p>
    <ul v-else class="flex flex-col text-[13.5px]">
      <li v-for="row in rows" :key="row.id" class="border-b border-dl-line-soft last:border-0">
        <RouterLink :to="{ name: 'tenant-visit-detail', params: { id: row.id } }" class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-dl-fg no-underline hover:bg-dl-mist" :class="row.status === 'cancelled' && 'opacity-60'">
          <span class="w-28 shrink-0 first-letter:uppercase">{{ text.day(row.visit_date) }}</span>
          <span class="min-w-0 flex-1">
            <strong class="font-semibold">{{ showTarget ? row.target.name : row.user?.full_name }}</strong>
            <DlBadge v-if="row.off_list" size="sm" tone="warning" class="ms-1.5">{{ t('visits.offList') }}</DlBadge>
            <small class="block text-xs text-dl-muted">{{ text.brands(row) || (showTarget ? text.where(row.target) : row.canal?.name) }}</small>
          </span>
          <DlBadge size="sm" :tone="text.tone(row)" dot>{{ text.state(row) }}</DlBadge>
        </RouterLink>
      </li>
    </ul>
    <DlPagination v-if="total > perPage" v-model="page" v-model:per-page="perPage" :total="total" />
  </section>
</template>
