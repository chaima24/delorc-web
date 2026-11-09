<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import AuthHeading from '@/components/AuthHeading.vue'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import PasswordInput from '@/components/PasswordInput.vue'
import { useAuthStore } from '@/stores/auth'

// Opened from the link in the email: /set-password?token=…  Saving also opens the session.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const password = ref('')
const confirmation = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const passwordError = ref<string | undefined>()

async function save(): Promise<void> {
  error.value = null
  passwordError.value = undefined
  busy.value = true

  try {
    await auth.setPassword(token.value, password.value, confirmation.value)
    router.push({ name: 'home' })
  } catch (failure) {
    passwordError.value = fieldErrors(failure).password

    if (!passwordError.value) {
      error.value = errorMessage(failure) ?? t('errors.network')
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="save">
    <AuthHeading :title="t('auth.setPassword.title')" :text="t('auth.setPassword.text')" />
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <DlAlert v-if="!token">{{ t('auth.setPassword.noLink') }}</DlAlert>
    <template v-else>
      <PasswordInput
        v-model="password"
        :label="t('auth.setPassword.password')"
        :hint="t('auth.setPassword.rule')"
        :error="passwordError"
        autocomplete="new-password"
        autofocus
      />
      <PasswordInput v-model="confirmation" :label="t('auth.setPassword.confirm')" autocomplete="new-password" />
      <DlButton type="submit" variant="primary" size="lg" block icon-end="tabler-arrow-right" :loading="busy">
        {{ t('auth.setPassword.submit') }}
      </DlButton>
    </template>
  </form>
</template>
