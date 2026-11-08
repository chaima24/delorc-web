<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import type { TestResult } from '@/api/central/channels'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import { useAuthStore } from '@/stores/auth'

/** "Send a test" under an email account: prefilled with your own email, any address can be typed. */
const props = defineProps<{ send: (to: string) => Promise<TestResult> }>()

const { t, d } = useI18n()
const auth = useAuthStore()
const to = ref(auth.user?.email ?? '')
const busy = ref(false)
const sentAt = ref<string | null>(null)
const failure = ref<string | null>(null)
const fieldError = ref<string | undefined>()

async function test(): Promise<void> {
  busy.value = true
  sentAt.value = failure.value = null
  fieldError.value = undefined
  try {
    sentAt.value = (await props.send(to.value)).at
  } catch (error) {
    fieldError.value = fieldErrors(error).to
    if (!fieldError.value) failure.value = errorMessage(error) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="border-t border-dl-line-soft pt-3">
    <div class="flex items-end gap-2">
      <DlInput v-model="to" type="email" :label="t('central.channels.testTo')" :error="fieldError" class="flex-1" />
      <DlButton variant="outline" size="sm" :loading="busy" class="mb-px h-10" @click="test">{{ t('central.channels.test') }}</DlButton>
    </div>
    <p v-if="sentAt" class="mt-2.5 rounded-xl bg-dl-signal-soft px-3 py-2.5 text-[13px] text-dl-fg">
      {{ t('central.channels.sent', { to, time: d(new Date(sentAt), { timeStyle: 'short' }) }) }}
    </p>
    <p v-if="failure" class="mt-2.5 rounded-xl bg-dl-rejected/10 px-3 py-2.5 text-[13px] text-dl-rejected">
      <strong>{{ t('central.channels.notSent') }}</strong> {{ failure }}
    </p>
  </div>
</template>
