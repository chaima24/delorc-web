<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import DlIcon from '@/components/DlIcon.vue'
import type { AttentionItem } from '@/api/central/attention'
import { useAttentionStore } from '@/stores/attention'
import { useLabTexts } from '@/views/central/labs/useLabTexts'

/** The bell: what needs attention now. The red count is the number of items; each item opens its list already filtered. */
const { t } = useI18n()
const { day } = useLabTexts()
const attention = useAttentionStore()
const open = ref(false)

const LINKS = {
  labs_in_grace: { name: 'central-labs', query: { period: 'grace' } },
  trials_ending: { name: 'central-labs', query: { period: 'trial', ending: '1' } },
  near_limit: { name: 'central-usage', query: { near: '1' } },
} as const

const ICONS = { labs_in_grace: 'tabler-hourglass', trials_ending: 'tabler-clock', near_limit: 'tabler-alert-triangle' } as const

function detail(item: AttentionItem): string {
  if (item.key === 'labs_in_grace') {
    return item.labs.map((lab) => t('central.attention.endsOn', { name: lab.name, date: day(lab.date ?? null) })).join(' · ')
  }
  if (item.key === 'trials_ending') {
    const first = item.labs[0]

    return first ? t('central.attention.firstTrial', { name: first.name, date: day(first.date ?? null) }) : ''
  }

  return item.labs.map((lab) => t('central.attention.percent', { name: lab.name, metric: t(`central.usage.${lab.metric}`), percent: lab.percent })).join(' · ')
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :aria-label="t('central.topbar.notifications')"
        class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dl-line bg-dl-paper text-dl-fg hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
      >
        <DlIcon icon="tabler-bell" :size="20" />
        <span
          v-if="attention.items.length"
          class="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-dl-rejected px-1 text-[11.5px] font-bold text-white"
        >
          {{ attention.items.length }}
        </span>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="end"
        :side-offset="8"
        class="z-2100 w-[380px] max-w-[calc(100vw-32px)] rounded-2xl border border-dl-line bg-dl-paper text-dl-fg shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]"
      >
        <p class="px-4 pb-2.5 pt-3.5 text-[15px] font-semibold">{{ t('central.attention.title') }}</p>
        <RouterLink
          v-for="item in attention.items"
          :key="item.key"
          :to="LINKS[item.key]"
          class="flex items-start gap-3 border-t border-dl-line-soft px-4 py-3 no-underline hover:bg-dl-line-soft"
          @click="open = false"
        >
          <span
            class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
            :class="item.key === 'trials_ending' ? 'bg-dl-mist text-dl-fg' : 'bg-dl-pending/12 text-dl-pending'"
          >
            <DlIcon :icon="ICONS[item.key]" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm text-dl-fg">{{ t(`central.attention.${item.key}`, { count: item.count }, item.count) }}</span>
            <span class="mt-0.5 block text-[12.5px] text-dl-muted">{{ detail(item) }}</span>
          </span>
          <span class="whitespace-nowrap text-[13px] font-semibold text-dl-cobalt">{{ t('central.attention.see') }} ›</span>
        </RouterLink>
        <p v-if="!attention.items.length" class="border-t border-dl-line-soft px-4 py-6 text-center text-sm text-dl-muted">
          {{ t('central.attention.nothing') }}
        </p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
