<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { activityLogApi, type ActivityLine } from '@/api/central/activityLog'
import type { Lab } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlPagination from '@/components/DlPagination.vue'
import ActivityAvatar from '../activity/ActivityAvatar.vue'
import { useActivityTexts } from '../activity/useActivityTexts'

/** The lines of the central log for this lab, newest first. */
const props = defineProps<{ lab: Lab }>()

const { t, d } = useI18n()
const { chips } = useActivityTexts()

const lines = ref<ActivityLine[]>([])
const total = ref(0)
const page = ref(1)
const perPage = ref(25)
const loaded = ref(false)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  try {
    const answer = await activityLogApi.list({ lab: props.lab.id }, page.value, perPage.value)
    lines.value = answer.data
    total.value = answer.meta.total
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    loaded.value = true
  }
}

onMounted(load)
watch([page, perPage], load)
</script>

<template>
  <div class="rounded-3xl bg-dl-paper p-4">
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <DlEmptyState v-else-if="loaded && !lines.length" :title="t('central.labs.noActivity')" icon="tabler-history" />
    <template v-else>
      <div v-for="line in lines" :key="line.id" class="flex items-start gap-3 rounded-[14px] p-3">
        <ActivityAvatar :author="line.author" />
        <div class="min-w-0 flex-1">
          <i18n-t :keypath="`central.activity.sentence.lab.${line.action}`" tag="p" class="text-sm">
            <template #author><strong>{{ line.author.type === 'person' ? line.author.name : t('central.activity.system') }}</strong></template>
            <template #record><strong>{{ line.record?.name ?? lab.name }}</strong></template>
          </i18n-t>
          <div v-if="chips(line).length" class="mt-1.5 flex flex-wrap gap-1.5">
            <DlBadge v-for="chip in chips(line)" :key="chip" size="sm">{{ chip }}</DlBadge>
          </div>
        </div>
        <time :datetime="line.created_at" class="whitespace-nowrap text-xs text-dl-muted">{{ d(new Date(line.created_at), { dateStyle: 'medium', timeStyle: 'short' }) }}</time>
      </div>
      <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
    </template>
  </div>
</template>
