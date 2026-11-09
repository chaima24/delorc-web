<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import DlButton from '@/components/DlButton.vue'
import DlLogo from '@/components/DlLogo.vue'
import { useAuthStore } from '@/stores/auth'

// Placeholder: the page after sign-in, until the central and lab shells exist.
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

async function signOut(): Promise<void> {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <main class="grid min-h-screen place-items-center p-4">
    <div class="flex flex-col items-center gap-4">
      <DlLogo :size="48" wordmark />
      <p class="text-dl-body">{{ auth.user?.name }}</p>
      <DlButton variant="outline" @click="signOut">{{ t('auth.logout') }}</DlButton>
    </div>
  </main>
</template>
