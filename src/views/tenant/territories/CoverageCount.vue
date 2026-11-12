<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Coverage } from './useCoverage'

// The dark box with the live count of professionals covered, and the count by kind.
const props = defineProps<{ coverage: Coverage | null; counting?: boolean }>()
const { t, n } = useI18n()
const byType = computed(() => Object.entries(props.coverage?.by_type ?? {})
  .map(([type, count]) => t(`territories.typeCount.${type}`, { n: n(count) }, count))
  .join(' · '))
</script>

<template>
  <div class="flex items-center gap-3 rounded-2xl bg-dl-ink px-4 py-3 text-[13px] text-dl-on-ink dark:bg-dl-mist dark:text-dl-fg" aria-live="polite">
    <strong class="font-display text-xl text-dl-signal tabular-nums dark:text-dl-fg">{{ coverage ? n(coverage.count) : '—' }}</strong>
    <span class="flex min-w-0 flex-col">
      <span>{{ t('territories.covers.covered', coverage?.count ?? 0) }}</span>
      <span v-if="byType" class="text-xs text-dl-on-ink-muted dark:text-dl-muted">{{ byType }}</span>
    </span>
    <span v-if="counting" class="ms-auto text-xs text-dl-on-ink-muted dark:text-dl-muted">{{ t('territories.loading') }}</span>
  </div>
</template>
