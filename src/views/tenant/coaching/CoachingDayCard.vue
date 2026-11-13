<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CoachingSessionPage } from '@/api/tenant/coaching'
import DlBadge from '@/components/DlBadge.vue'

// The person's visits of the session's day where the coach went along ("Accompagné par").
defineProps<{ visits: CoachingSessionPage['visits'] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col">
    <div class="mb-1 flex items-center gap-2">
      <h3 class="flex-1 text-sm font-semibold">{{ t('coaching.sessions.day.title') }}</h3>
      <DlBadge size="sm">{{ t('coaching.sessions.day.count', visits.length) }}</DlBadge>
    </div>
    <p v-if="!visits.length" class="py-2 text-[13px] text-dl-muted">{{ t('coaching.sessions.day.none') }}</p>
    <div v-for="visit in visits" :key="visit.id" class="flex flex-wrap items-baseline gap-x-2.5 border-b border-dl-line-soft py-1.5 text-[13px] last:border-b-0">
      <strong class="min-w-0 flex-1 font-semibold">{{ visit.target }}</strong>
      <span class="text-xs text-dl-muted">{{ [visit.speciality, visit.commune].filter(Boolean).join(' · ') }}</span>
      <span v-if="visit.brands.length" class="text-xs text-dl-muted">{{ visit.brands.join(', ') }}</span>
    </div>
  </div>
</template>
