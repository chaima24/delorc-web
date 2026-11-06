<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { authApi, type TwoFactorChallenge } from '@/api/auth'
import { errorMessage, fieldErrors } from '@/api/errors'
import DlAlert from '@/components/DlAlert.vue'
import AuthHeading from '@/components/AuthHeading.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import PasswordInput from '@/components/PasswordInput.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const code = ref('')
/** Set once the password is right and the API asks for the second step. */
const challenge = ref<TwoFactorChallenge | null>(null)

const busy = ref(false)
const resending = ref(false)
const error = ref<string | null>(null)
const codeError = ref<string | undefined>()
const notice = ref<string | null>(null)

const usesSentCode = computed(() => challenge.value?.method === 'email' || challenge.value?.method === 'sms')

function clearMessages(): void {
  error.value = null
  codeError.value = undefined
  notice.value = null
}

function openApp(): void {
  const target = route.query.redirect

  router.push(typeof target === 'string' ? target : { name: 'home' })
}

async function signIn(): Promise<void> {
  clearMessages()
  busy.value = true

  try {
    const answer = await auth.login(email.value, password.value)

    if (answer.status === 'ok') {
      openApp()
    } else {
      challenge.value = answer
    }
  } catch (failure) {
    // One general message, whichever field the API filed it under: it never says which one was wrong.
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}

function useAnotherAccount(): void {
  clearMessages()
  challenge.value = null
  password.value = ''
  code.value = ''
}

async function verify(): Promise<void> {
  clearMessages()
  busy.value = true

  try {
    await auth.verifyTwoFactor(challenge.value!.challenge, code.value)
    openApp()
  } catch (failure) {
    const errors = fieldErrors(failure)

    if (errors.challenge) {
      useAnotherAccount()
      error.value = errors.challenge
    } else if (errors.code) {
      codeError.value = errors.code
    } else {
      error.value = errorMessage(failure) ?? t('errors.network')
    }
  } finally {
    busy.value = false
  }
}

async function resend(): Promise<void> {
  clearMessages()
  resending.value = true

  try {
    const { data } = await authApi.resendCode(challenge.value!.challenge)
    notice.value = data.message
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <form v-if="challenge" class="flex flex-col gap-4" novalidate @submit.prevent="verify">
    <AuthHeading
      :title="t(`auth.twoFactor.${challenge.method}.title`)"
      :text="t(`auth.twoFactor.${challenge.method}.text`)"
    />
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <DlAlert v-if="notice" tone="success">{{ notice }}</DlAlert>
    <DlInput
      v-model="code"
      :label="t('auth.twoFactor.code')"
      :hint="t(`auth.twoFactor.${challenge.method}.hint`)"
      :error="codeError"
      :placeholder="usesSentCode ? '000000' : undefined"
      maxlength="20"
      autocomplete="one-time-code"
      autofocus
      large
      code
    />
    <DlButton type="submit" variant="primary" size="lg" block icon-end="tabler-arrow-right" :loading="busy">
      {{ t('auth.twoFactor.submit') }}
    </DlButton>
    <div class="flex justify-between gap-2 text-sm font-semibold">
      <button type="button" class="text-dl-muted" @click="useAnotherAccount">{{ t('auth.twoFactor.otherAccount') }}</button>
      <button v-if="usesSentCode" type="button" class="text-dl-cobalt" :disabled="resending" @click="resend">
        {{ t('auth.twoFactor.resend') }}
      </button>
    </div>
  </form>

  <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="signIn">
    <AuthHeading :title="t('auth.login.title')" :text="t('auth.login.text')" />
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <DlInput v-model="email" :label="t('auth.login.email')" type="email" autocomplete="username" autofocus large />
    <PasswordInput v-model="password" :label="t('auth.login.password')" autocomplete="current-password" />
    <RouterLink :to="{ name: 'forgot-password' }" class="self-end text-sm font-semibold text-dl-cobalt">
      {{ t('auth.login.forgot') }}
    </RouterLink>
    <DlButton type="submit" variant="primary" size="lg" block icon-end="tabler-arrow-right" :loading="busy">
      {{ t('auth.login.submit') }}
    </DlButton>
  </form>
</template>
