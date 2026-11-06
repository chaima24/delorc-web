<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

/** Texts and Languages, at the top of both pages. */
defineProps<{ texts?: number; languages?: number }>()

const { t, n } = useI18n()
const auth = useAuthStore()
const tab = 'flex h-[34px] items-center gap-1.5 rounded-[11px] bg-dl-paper px-3 text-[13px] font-semibold text-dl-body no-underline'
const active = 'bg-dl-signal-soft! text-dl-fg! shadow-[inset_0_0_0_1.5px_rgb(var(--dl-ink))]'
</script>

<template>
  <nav class="flex flex-wrap gap-1.5" :aria-label="t('central.menu.translations')">
    <RouterLink v-if="auth.can('translations.show')" :to="{ name: 'central-translations' }" :class="tab" :active-class="active">
      {{ t('central.translations.texts') }} <small v-if="texts !== undefined" class="text-dl-muted">{{ n(texts) }}</small>
    </RouterLink>
    <RouterLink v-if="auth.can('languages.show')" :to="{ name: 'central-languages' }" :class="tab" :active-class="active">
      {{ t('central.languages.title') }} <small v-if="languages !== undefined" class="text-dl-muted">{{ n(languages) }}</small>
    </RouterLink>
  </nav>
</template>
