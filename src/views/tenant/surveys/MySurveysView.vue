<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchMySurveys, type MySurvey } from '@/api/tenant/surveys'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import MySurveyCard from './MySurveyCard.vue'

// Enquêtes › Mes enquêtes: the open surveys I answer, one card each. Mockup: surveys-mockups/Respondents.html frame 8.
const { t } = useI18n()
const surveys = ref<MySurvey[] | null>(null)
onMountedAndFocus(async () => {
  surveys.value = await fetchMySurveys().catch(() => [])
})
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-sm text-dl-muted">{{ t('nav.workspaces.surveys') }}</span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('surveys.mine.title') }}</h1>
      <p class="text-[13px] text-dl-muted">{{ t('surveys.mine.subtitle') }}</p>
    </div>
    <div v-if="!surveys" class="grid gap-4 xl:grid-cols-2"><DlSkeleton class="h-72 rounded-3xl" /><DlSkeleton class="h-72 rounded-3xl" /></div>
    <DlEmptyState v-else-if="!surveys.length" icon="tabler-clipboard-check" :title="t('surveys.mine.emptyTitle')" :description="t('surveys.mine.emptyText')" />
    <div v-else class="grid items-start gap-4 xl:grid-cols-2">
      <MySurveyCard v-for="survey in surveys" :key="survey.id" :survey="survey" />
    </div>
  </div>
</template>
