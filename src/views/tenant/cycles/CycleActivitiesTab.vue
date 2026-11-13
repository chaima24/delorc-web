<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { fetchAllActivities, type Activity } from '@/api/tenant/activities'
import type { CycleDetail } from '@/api/tenant/cycles'
import DlBadge from '@/components/DlBadge.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { KIND_TONE, useActivityText } from '@/views/tenant/activities/activityDisplay'

// The person's activities in the cycle's period (theirs, or ones they are linked to).
const props = defineProps<{ cycle: CycleDetail }>()
const { t } = useI18n()
const text = useActivityText()

const rows = ref<Activity[]>([])
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    rows.value = props.cycle.user
      ? await fetchAllActivities({ 'filter[user_id]': props.cycle.user.id, 'filter[period]': `${props.cycle.start_date},${props.cycle.end_date}` })
      : []
  }
  finally {
    loading.value = false
  }
}
watch(() => props.cycle.id, load, { immediate: true })
</script>

<template>
  <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
    <div v-if="loading" class="flex flex-col gap-2"><DlSkeleton v-for="i in 3" :key="i" class="h-12 rounded-xl" /></div>
    <p v-else-if="!rows.length" class="py-8 text-center text-sm text-dl-muted">{{ t('cycles.activities.empty') }}</p>
    <ul v-else class="flex flex-col gap-1.5">
      <li v-for="activity in rows" :key="activity.id" class="grid grid-cols-[150px_1fr_auto] items-center gap-3.5 rounded-2xl border border-dl-line-soft px-3.5 py-3 text-[13.5px] max-md:grid-cols-1 max-md:gap-1">
        <span class="text-[12.5px] text-dl-body">{{ text.when(activity) }}</span>
        <span class="min-w-0"><strong class="block truncate font-semibold">{{ activity.title }}</strong><small class="text-xs text-dl-muted">{{ activity.activity_type?.activity }}</small></span>
        <DlBadge size="sm" :tone="KIND_TONE[activity.kind ?? 'field']">{{ text.kind(activity.kind ?? 'field') }}</DlBadge>
      </li>
    </ul>
    <RouterLink :to="{ name: 'tenant-activities', query: { month: cycle.start_date.slice(0, 7) } }" class="mt-1 text-[13px] font-semibold text-dl-cobalt no-underline hover:underline">{{ t('cycles.activities.open') }}</RouterLink>
  </section>
</template>
