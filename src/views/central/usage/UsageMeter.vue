<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { percentOf } from '@/api/central/usage'
import DlBadge from '@/components/DlBadge.vue'

/** A number against its limit, with a small bar: amber from 80%, red at 100%. A null limit is unlimited, 0 is none. */
const props = defineProps<{ value: number; limit: number | null; unit?: string; decimals?: number }>()

const { t, n } = useI18n()
const percent = computed(() => percentOf(props.value, props.limit))
const tone = computed(() => (percent.value === null ? null : percent.value >= 100 ? 'danger' : percent.value >= 80 ? 'warning' : null))
const shown = (amount: number) => `${n(amount, { maximumFractionDigits: props.decimals ?? 0 })}${props.unit ? ` ${props.unit}` : ''}`
</script>

<template>
  <div class="min-w-[120px]">
    <div class="flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-dl-fg">
      {{ shown(value) }}
      <span class="font-normal text-dl-muted">
        {{ limit === null ? t('central.usage.noLimit') : limit === 0 ? t('central.usage.none') : t('central.usage.of', { limit: shown(limit) }) }}
      </span>
      <DlBadge v-if="tone === 'danger'" tone="danger" size="sm">{{ t('central.usage.over') }}</DlBadge>
      <DlBadge v-else-if="tone === 'warning'" tone="warning" size="sm">{{ n(Math.round(percent!)) }}%</DlBadge>
    </div>
    <div v-if="percent !== null" class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-dl-line-soft">
      <i class="block h-full rounded-full" :class="tone === 'danger' ? 'bg-dl-rejected' : tone === 'warning' ? 'bg-dl-pending' : 'bg-dl-ink'" :style="{ width: `${Math.min(100, percent)}%` }" />
    </div>
  </div>
</template>
