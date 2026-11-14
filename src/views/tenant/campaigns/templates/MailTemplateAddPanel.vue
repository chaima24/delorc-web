<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createMailTemplate, type MailChannel, type MailTemplate } from '@/api/tenant/campaignMessages'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useBrandOptions } from './useBrandOptions'

// "+ Ajouter un modèle": the channel (fixed afterwards), a name, an optional brand. The text is written on its page.
const emit = defineEmits<{ created: [template: MailTemplate] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const { brands } = useBrandOptions()

const NONE = 0
const form = ref({ channel: 'email' as MailChannel, label: '', brand_id: NONE })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = { channel: 'email', label: '', brand_id: NONE }
  errors.value = {}
}, { immediate: true })
const channels = computed(() => (['email', 'sms'] as const).map(value => ({ value, label: t(`campaignMessages.channel.${value}`) })))
const brandItems = computed(() => [{ value: NONE, label: t('campaignMessages.templates.allBrands') }, ...brands.value])
const channel = computed({ get: () => form.value.channel, set: value => { form.value.channel = value as MailChannel } })
const brand = computed({ get: () => form.value.brand_id, set: value => { form.value.brand_id = Number(value ?? NONE) } })

async function save() {
  errors.value = {}
  saving.value = true
  try {
    emit('created', await createMailTemplate({ channel: form.value.channel, label: form.value.label, brand_id: form.value.brand_id || null }))
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
  <DlRecordPanel v-model:open="open" :title="t('campaignMessages.templates.addTitle')" :description="t('campaignMessages.templates.addDescription')">
    <form id="template-add" class="flex flex-col gap-4" @submit.prevent="save">
      <div v-if="auth.hasFeature('channel.sms')" class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('campaignMessages.columns.channel') }}</span>
        <DlSegmented v-model="channel" :label="t('campaignMessages.columns.channel')" :items="channels" block />
        <span v-if="errors.channel" class="text-xs text-dl-rejected">{{ errors.channel }}</span>
      </div>
      <DlInput v-model="form.label" :label="t('campaignMessages.templates.name')" :error="errors.label" />
      <DlSelect v-model="brand" :label="t('campaignMessages.templates.brand')" :options="brandItems" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="template-add" variant="primary" class="ms-auto" :loading="saving">{{ t('campaignMessages.templates.addSave') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
