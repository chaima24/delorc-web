<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchCoachingSettings, saveCoachingSettings } from '@/api/tenant/coaching'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

// Coaching › Réglages: the lab's settings for sessions, saved on change. Mockup frame 10.
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('coaching-setup.update'))

const settings = ref<{ one_per_day: boolean } | null>(null)
fetchCoachingSettings().then(value => { settings.value = value })

async function setOnePerDay(value: boolean) {
  try {
    settings.value = await saveCoachingSettings({ one_per_day: value })
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-sm text-dl-muted">{{ t('nav.workspaces.coaching') }}</span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('coaching.settings.title') }}</h1>
    </div>
    <DlSkeleton v-if="!settings" class="h-24 rounded-3xl" />
    <section v-else class="flex items-center gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
      <div class="min-w-0 flex-1">
        <strong class="text-sm">{{ t('coaching.settings.onePerDay') }}</strong>
        <p class="text-[13px] text-dl-muted">{{ t('coaching.settings.onePerDayHint') }}</p>
      </div>
      <DlSwitch :model-value="settings.one_per_day" :label="''" :aria-label="t('coaching.settings.onePerDay')" :disabled="!canEdit" @update:model-value="setOnePerDay" />
    </section>
    <p class="text-xs text-dl-muted">{{ t('coaching.settings.note') }}</p>
  </div>
</template>
