<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DlLogo from '@/components/DlLogo.vue'

/** Dark brand side of the sign-in pages (desktop only). */
const { t } = useI18n()
</script>

<template>
  <aside class="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-dl-ink p-12 text-dl-on-ink lg:flex">
    <DlLogo :size="48" wordmark on-dark />

    <svg
      class="pointer-events-none absolute -inset-e-24 top-[40%] size-[460px] -translate-y-1/2 rtl:-scale-x-100"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        d="M15 28 V13 H23 A11 11 0 0 1 23 35 H21"
        fill="none"
        class="stroke-dl-ink-2"
        stroke-width="4.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="15" cy="35" r="3.2" class="fill-dl-signal" />
    </svg>

    <div class="relative flex max-w-[420px] flex-col gap-4">
      <h2 class="font-display text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em]">
        {{ t('auth.brand.tagline') }}
      </h2>
      <p class="text-base leading-relaxed text-dl-on-ink-muted">
        {{ t('auth.brand.body') }}
      </p>
    </div>
  </aside>
</template>
