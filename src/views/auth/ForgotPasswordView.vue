<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { authApi } from '@/api/auth'
import { errorMessage } from '@/api/errors'
import AuthHeading from '@/components/AuthHeading.vue'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'

const { t } = useI18n()

const email = ref('')
const busy = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)

async function send(): Promise<void> {
  error.value = null
  busy.value = true

  try {
    await authApi.forgotPassword(email.value)
    sent.value = true
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="sent" class="flex flex-col gap-4">
    <div class="grid size-14 place-items-center rounded-[18px] bg-dl-signal text-dl-ink">
      <DlIcon icon="tabler-check" :size="26" />
    </div>
    <AuthHeading :title="t('auth.forgot.sentTitle')" :text="t('auth.forgot.sentText')" />
    <RouterLink :to="{ name: 'login' }" class="text-sm font-semibold text-dl-muted">{{ t('auth.forgot.back') }}</RouterLink>
  </div>

  <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="send">
    <AuthHeading :title="t('auth.forgot.title')" :text="t('auth.forgot.text')" />
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <DlInput v-model="email" :label="t('auth.login.email')" type="email" autocomplete="username" autofocus large />
    <DlButton type="submit" variant="primary" size="lg" block icon-end="tabler-arrow-right" :loading="busy">
      {{ t('auth.forgot.submit') }}
    </DlButton>
    <RouterLink :to="{ name: 'login' }" class="text-sm font-semibold text-dl-muted">{{ t('auth.forgot.back') }}</RouterLink>
  </form>
</template>
