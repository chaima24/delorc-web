<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { humanize } from './accessCatalog'

/** One action as a small box: ticked in blue when allowed, empty when not. */
const props = defineProps<{ action: string; on: boolean }>()
const { t } = useI18n()
const label = () => `${t(`access.action.${props.action}`, humanize(props.action))} · ${t(props.on ? 'access.matrix.allowed' : 'access.matrix.notAllowed')}`
</script>

<template>
  <span
    class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px]"
    :class="on ? 'border-dl-cobalt text-dl-cobalt' : 'border-dl-line'"
    role="img"
    :aria-label="label()"
    :title="label()"
  >
    <svg v-if="on" viewBox="0 0 12 12" class="h-2.5 w-2.5" aria-hidden="true"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </span>
</template>
