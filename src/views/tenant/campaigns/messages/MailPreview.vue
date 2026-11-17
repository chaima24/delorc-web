<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { previewEmail, previewSms, type MailChannel } from '@/api/tenant/campaignMessages'
import DlSkeleton from '@/components/DlSkeleton.vue'

/**
 * The text as a professional gets it, asked to the API a moment after typing stops: the email in the lab's look inside
 * a sandboxed frame (no script runs), or the SMS on a phone with its length. Fields are filled with the example.
 */
const props = defineProps<{ channel: MailChannel; subject: string; body: string; campaignId?: number; files?: number }>()
const { t, n } = useI18n()

const email = ref<{ subject: string; html: string } | null>(null)
const sms = ref<{ text: string; length: number; parts: number } | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  try {
    if (props.channel === 'sms') sms.value = await previewSms({ body: props.body, campaign_id: props.campaignId })
    else email.value = await previewEmail({ subject: props.subject, body: props.body, campaign_id: props.campaignId })
  }
  catch {
    // A text the API refuses (an unknown field) keeps the last preview; the field shows the error on save.
  }
}
watch(() => [props.subject, props.body], () => {
  clearTimeout(timer)
  timer = setTimeout(load, 500)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="flex flex-col gap-2.5 rounded-3xl bg-dl-line-soft p-4">
    <span class="text-[12.5px] text-dl-body">{{ t('campaignMessages.preview.example') }} <strong class="text-dl-fg">{{ t('campaignMessages.preview.exampleName') }}</strong></span>
    <template v-if="channel === 'email'">
      <span class="text-[12.5px] text-dl-body">{{ t('campaignMessages.fields.subject') }} : <strong class="text-dl-fg">{{ email?.subject || '—' }}</strong></span>
      <DlSkeleton v-if="!email" class="h-80 rounded-xl" />
      <iframe v-else :srcdoc="email.html" sandbox="" :title="t('campaignMessages.preview.title')" class="h-[560px] w-full rounded-xl border-0 bg-white" />
      <span v-if="files" class="text-[12.5px] text-dl-body">📎 {{ t('campaignMessages.preview.files', files) }}</span>
    </template>
    <div v-else class="mx-auto w-[300px] rounded-[34px] bg-dl-ink p-3.5">
      <div class="flex min-h-72 flex-col gap-2 rounded-3xl bg-dl-mist px-3.5 py-4">
        <span class="text-center text-[11px] text-dl-muted">{{ t('campaignMessages.preview.phone') }}</span>
        <p v-if="sms?.text" class="whitespace-pre-line rounded-2xl rounded-es-sm bg-dl-paper px-3 py-2.5 text-[13px] leading-normal shadow-sm">{{ sms.text }}</p>
      </div>
      <p v-if="sms" class="mt-3 text-center text-xs text-dl-on-ink-muted">{{ t('campaignMessages.sms.count', { length: n(sms.length), parts: n(sms.parts) }) }}</p>
    </div>
  </div>
</template>
