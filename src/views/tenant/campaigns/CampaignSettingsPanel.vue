<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchCampaignSettings, saveCampaignSettings, type CampaignSettings } from '@/api/tenant/campaigns'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useToast } from '@/composables/useToast'

// "⚙ Réglages" on the Campagnes page: what the tick window of the promo grid asks for, saved on change. Mockup frame 10.
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const settings = ref<CampaignSettings | null>(null)
fetchCampaignSettings().then(value => { settings.value = value })

async function set(key: keyof CampaignSettings, value: boolean) {
  if (!settings.value) return
  try {
    settings.value = await saveCampaignSettings({ ...settings.value, [key]: value })
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('campaigns.settings.title')" :description="t('campaigns.settings.description')">
    <DlSkeleton v-if="!settings" class="h-32 rounded-2xl" />
    <div v-else class="flex flex-col gap-4">
      <section v-for="key in (['priority_required', 'message_required'] as const)" :key="key" class="flex items-center gap-4 rounded-2xl border border-dl-line p-4">
        <div class="min-w-0 flex-1">
          <strong class="text-sm">{{ t(`campaigns.settings.${key}`) }}</strong>
          <p class="text-[13px] text-dl-muted">{{ t(`campaigns.settings.${key}Hint`) }}</p>
        </div>
        <DlSwitch :model-value="settings[key]" label="" :aria-label="t(`campaigns.settings.${key}`)" @update:model-value="value => set(key, value)" />
      </section>
      <p class="text-xs text-dl-muted">{{ t('campaigns.settings.note') }}</p>
    </div>
  </DlRecordPanel>
</template>
