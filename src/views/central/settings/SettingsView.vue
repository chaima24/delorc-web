<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { settingsApi, type Settings } from '@/api/central/settings'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useAuthStore } from '@/stores/auth'
import SharedMailCard from '../channels/SharedMailCard.vue'
import { usePanelAction } from '../geography/usePanelAction'

/** Values the Delorc team changes without a deploy. Each later module adds its own card here. */
const { t } = useI18n()
const auth = useAuthStore()
const { errors, error, busy, run, clear } = usePanelAction()

const settings = ref<Settings | null>(null)
const loadError = ref<string | null>(null)
const editing = ref(false)
const form = ref({ trial_months: '', grace_days: '', export_days: '' })

function reset(): void {
  if (!settings.value) return
  const { trial_months, grace_days, export_days } = settings.value.labs
  form.value = { trial_months: String(trial_months), grace_days: String(grace_days), export_days: String(export_days) }
  editing.value = false
  clear()
}

onMounted(async () => {
  try {
    settings.value = await settingsApi.get()
    reset()
  } catch (failure) {
    loadError.value = errorMessage(failure) ?? t('errors.network')
  }
})

const save = () => run(
  () => settingsApi.save({ labs: { trial_months: Number(form.value.trial_months), grace_days: Number(form.value.grace_days), export_days: Number(form.value.export_days) } }),
  (saved) => {
    settings.value = saved
    reset()
  },
)
const row = 'flex items-start gap-2.5 border-t border-dl-line-soft py-2.5 first:border-t-0'
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.settings.title') }}</h1>
    <DlAlert v-if="loadError">{{ loadError }}</DlAlert>

    <div v-if="settings" class="flex flex-col gap-4">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <DlRecordSection v-model:editing="editing" :title="t('central.settings.labs')" :can-edit="auth.can('settings.update')" :saving="busy" class="bg-dl-paper" @save="save" @cancel="reset">
        <dl class="text-sm">
          <div :class="row">
            <dt class="flex-1"><strong class="block">{{ t('central.settings.trialMonths') }}</strong><span class="text-[12.5px] text-dl-muted">{{ t('central.settings.trialMonthsHint') }}</span></dt>
            <dd class="font-semibold text-dl-fg">{{ t('central.settings.months', { count: settings.labs.trial_months }) }}</dd>
          </div>
          <div :class="row">
            <dt class="flex-1"><strong class="block">{{ t('central.settings.graceDays') }}</strong><span class="text-[12.5px] text-dl-muted">{{ t('central.settings.graceDaysHint') }}</span></dt>
            <dd class="font-semibold text-dl-fg">{{ t('central.settings.days', { count: settings.labs.grace_days }) }}</dd>
          </div>
          <div :class="row">
            <dt class="flex-1"><strong class="block">{{ t('central.settings.exportDays') }}</strong><span class="text-[12.5px] text-dl-muted">{{ t('central.settings.exportDaysHint') }}</span></dt>
            <dd class="font-semibold text-dl-fg">{{ t('central.settings.days', { count: settings.labs.export_days }) }}</dd>
          </div>
        </dl>
        <template #edit>
          <div class="grid gap-3 sm:grid-cols-2">
            <DlInput v-model="form.trial_months" type="number" min="1" max="12" :label="t('central.settings.trialMonthsField')" :hint="t('central.settings.trialMonthsApplies')" :error="errors['labs.trial_months']" />
            <DlInput v-model="form.grace_days" type="number" min="0" max="60" :label="t('central.settings.graceDays')" :hint="t('central.settings.graceDaysApplies')" :error="errors['labs.grace_days']" />
            <DlInput v-model="form.export_days" type="number" min="1" max="30" :label="t('central.settings.exportDays')" :hint="t('central.settings.exportDaysApplies')" :error="errors['labs.export_days']" />
          </div>
        </template>
      </DlRecordSection>

      <SharedMailCard v-if="auth.can('channels.show')" />

      <!-- SMS: lab side only, once a provider is chosen. -->
      <DlRecordSection :title="t('central.channels.sms')" :can-edit="false" class="bg-dl-paper opacity-60">
        <DlBadge tone="info" size="sm">{{ t('central.channels.smsLater') }}</DlBadge>
        <p class="mt-1.5">{{ t('central.channels.smsCentral') }}</p>
      </DlRecordSection>
    </div>
  </div>
</template>
