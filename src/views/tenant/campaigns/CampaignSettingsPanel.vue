<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchCampaignSettings, saveCampaignSettings, type CampaignSettings, type CampaignSettingsRead } from '@/api/tenant/campaigns'
import { saveEmailLook } from '@/api/tenant/campaignMessages'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import ColorField from '@/views/tenant/settings/shared/ColorField.vue'

// "⚙ Réglages" on the Campagnes page: what the tick window of the promo grid asks for (saved on change, mockup frame 10
// of Campaigns.html), and the email look every campaign email wears: logo, banner colour, footer (saved with its button,
// frame 12 of Messages.html).
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const settings = ref<CampaignSettingsRead | null>(null)
const look = ref({ email_color: '', email_footer: '', email_logo: null as File | null, remove_logo: false })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function take(value: CampaignSettingsRead) {
  settings.value = value
  look.value = { email_color: value.email_color, email_footer: value.email_footer, email_logo: null, remove_logo: false }
}
fetchCampaignSettings().then(take)

const grid = (value: CampaignSettingsRead): CampaignSettings => ({ priority_required: value.priority_required, message_required: value.message_required })
async function set(key: keyof CampaignSettings, value: boolean) {
  if (!settings.value) return
  try {
    const saved = await saveCampaignSettings({ ...grid(settings.value), [key]: value })
    settings.value = { ...settings.value, ...saved }
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

const picker = ref<HTMLInputElement | null>(null)
const logoPreview = ref<string | null>(null)
function pickLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return
  look.value.email_logo = file
  look.value.remove_logo = false
  logoPreview.value = URL.createObjectURL(file)
}
function dropLogo() {
  look.value.email_logo = null
  look.value.remove_logo = true
  logoPreview.value = null
}
const logoShown = () => logoPreview.value ?? (look.value.remove_logo ? null : settings.value?.email_logo_url ?? null)

async function saveLook() {
  if (!settings.value) return
  errors.value = {}
  saving.value = true
  try {
    take(await saveEmailLook(grid(settings.value), look.value))
    logoPreview.value = null
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
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

      <form class="flex flex-col gap-4 border-t border-dl-line pt-4" @submit.prevent="saveLook">
        <div>
          <strong class="text-sm">{{ t('campaignMessages.look.title') }}</strong>
          <p class="text-[13px] text-dl-muted">{{ t('campaignMessages.look.description') }}</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] font-semibold">{{ t('campaignMessages.look.logo') }}</span>
          <div class="flex items-center gap-3 rounded-xl border border-dl-line p-2.5">
            <span class="flex h-12 min-w-12 items-center justify-center rounded-[10px] px-2" :style="{ background: look.email_color }">
              <img v-if="logoShown()" :src="logoShown()!" alt="" class="max-h-8">
              <span v-else class="text-[11px] font-bold text-white">{{ t('campaignMessages.look.noLogo') }}</span>
            </span>
            <DlButton size="sm" variant="outline" icon="tabler-upload" @click="picker?.click()">{{ t('campaignMessages.look.pickLogo') }}</DlButton>
            <DlIconButton v-if="logoShown()" icon="tabler-x" variant="ghost" :label="t('campaignMessages.look.removeLogo')" @click="dropLogo" />
            <input ref="picker" type="file" accept="image/png,image/jpeg" class="hidden" @change="pickLogo">
          </div>
          <span class="text-xs" :class="errors.email_logo ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.email_logo ?? t('campaignMessages.look.logoHint') }}</span>
        </div>
        <ColorField v-model="look.email_color" :label="t('campaignMessages.look.color')" :error="errors.email_color" />
        <DlTextarea v-model="look.email_footer" :label="t('campaignMessages.look.footer')" :rows="3" :error="errors.email_footer" />
        <DlButton type="submit" variant="dark" class="self-end" :loading="saving">{{ t('campaignMessages.look.save') }}</DlButton>
      </form>
    </div>
  </DlRecordPanel>
</template>
