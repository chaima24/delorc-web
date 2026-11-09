<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AuthBrandPanel from '@/components/AuthBrandPanel.vue'
import AuthHeading from '@/components/AuthHeading.vue'
import DlLogo from '@/components/DlLogo.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useLabStore } from '@/stores/lab'

const { t } = useI18n()
const labs = useLabStore()
</script>

<template>
  <div class="flex min-h-screen bg-dl-mist font-sans text-dl-fg">
    <AuthBrandPanel />

    <main class="flex flex-1 items-center justify-center px-4 py-10">
      <div class="flex w-full max-w-[420px] flex-col gap-4">
        <DlLogo :size="40" wordmark class="mb-3 lg:hidden" />
        <!-- Not a lab, or a suspended one: the API's message instead of any form, and nothing to click. -->
        <template v-if="labs.unavailable">
          <span class="grid size-14 place-items-center rounded-[18px] bg-dl-rejected/10 text-dl-rejected">
            <DlIcon icon="tabler-alert-triangle" :size="26" />
          </span>
          <AuthHeading :title="labs.unavailable.message" :text="labs.unavailable.status === 404 ? t('auth.space.checkAddress') : ''" />
        </template>
        <RouterView v-else />
      </div>
    </main>
  </div>
</template>
