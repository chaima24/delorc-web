<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { profileApi } from '@/api/central/profile'
import { errorMessage } from '@/api/errors'
import AuthHeading from '@/components/AuthHeading.vue'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import { useAuthStore } from '@/stores/auth'

// Opened from the link sent to a new address: /email/confirm?token=…  It confirms at once, no session needed.
const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const token = typeof route.query.token === 'string' ? route.query.token : ''
const done = ref<string | null>(null)
const error = ref<string | null>(token ? null : t('auth.confirmEmail.noLink'))

onMounted(async () => {
  if (!token) return
  try {
    done.value = (await profileApi.confirmEmail(token)).message
    if (auth.user) auth.user = await auth.refreshUser()
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <AuthHeading :title="t('auth.confirmEmail.title')" :text="t('auth.confirmEmail.text')" />
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <DlAlert v-else-if="done" tone="success">{{ done }}</DlAlert>
    <DlButton v-if="done || error" :to="{ name: auth.isSignedIn ? 'central-profile' : 'login' }" variant="primary" size="lg" block icon-end="tabler-arrow-right">
      {{ auth.isSignedIn ? t('auth.confirmEmail.toProfile') : t('auth.login.submit') }}
    </DlButton>
  </div>
</template>
