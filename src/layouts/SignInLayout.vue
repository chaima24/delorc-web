<script setup lang="ts">
import AuthBrandPanel from '@/components/AuthBrandPanel.vue'
import DlLogo from '@/components/DlLogo.vue'
</script>

<template>
  <div class="flex min-h-screen bg-dl-mist font-sans text-dl-fg">
    <AuthBrandPanel />

    <main class="flex flex-1 items-center justify-center px-4 py-10">
      <div class="flex w-full max-w-[420px] flex-col gap-4">
        <DlLogo :size="40" wordmark class="mb-3 lg:hidden" />
        <RouterView />
      </div>
    </main>
  </div>
</template>
