<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Survey, SurveyQuestion } from '@/api/tenant/surveys'
import DlSheet from '@/components/DlSheet.vue'

// « Aperçu »: the survey as the rep will fill it (19b), read only. Mockup frame 7.
defineProps<{ survey: Survey }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const placeholder = (q: SurveyQuestion) => t(`surveys.preview.placeholder.${q.type}`)
</script>

<template>
  <DlSheet v-model:open="open" :title="t('surveys.preview.title')" :description="t('surveys.preview.description')" size="lg">
    <div class="flex flex-col gap-4 text-sm">
      <p v-if="!survey.questions?.length" class="text-dl-muted">{{ t('surveys.page.noQuestions') }}</p>
      <template v-for="q in survey.questions" :key="q.id">
        <h3 v-if="q.type === 'title'" class="rounded-xl bg-dl-mist px-3 py-2 text-[15px] font-bold">{{ q.question_text }}</h3>
        <div v-else class="flex flex-col gap-1.5" :class="q.parent_id ? 'ps-3' : ''">
          <span class="font-semibold">{{ q.number }}. {{ q.question_text }}<span v-if="q.is_required" class="text-dl-rejected"> *</span></span>
          <div v-if="q.options.length && q.display === 'expanded'" class="flex flex-wrap gap-2">
            <span v-for="o in q.options" :key="o.id" class="rounded-full border border-dl-line px-3 py-1 text-[13px]">
              {{ q.type === 'multiple_choice' ? '☐ ' : '' }}{{ o.label }}{{ o.is_other ? '…' : '' }}
            </span>
          </div>
          <div v-else-if="q.options.length" class="rounded-[10px] border border-dl-line px-3 py-2 text-[13px] text-dl-muted">{{ t('surveys.preview.pick') }} ▾</div>
          <div v-else class="rounded-[10px] border border-dl-line px-3 text-[13px] text-dl-muted" :class="q.type === 'free_text' ? 'h-20 py-2' : 'py-2'">{{ placeholder(q) }}</div>
        </div>
      </template>
    </div>
  </DlSheet>
</template>
