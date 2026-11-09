<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DlIcon from '@/components/DlIcon.vue'
import { ATTENTION_ICONS, ATTENTION_LINKS, isUrgent, useAttentionStore } from '@/stores/attention'

/** "Needs attention" on top of Labs: the same items as the bell. Hidden when there is nothing to do. */
const { t } = useI18n()
const attention = useAttentionStore()
</script>

<template>
  <div v-if="attention.items.length" class="flex flex-wrap gap-2.5" :aria-label="t('central.attention.title')">
    <RouterLink
      v-for="item in attention.items"
      :key="item.key"
      :to="ATTENTION_LINKS[item.key]"
      class="flex items-center gap-2.5 rounded-[14px] border bg-dl-paper px-3.5 py-2.5 text-sm text-dl-fg no-underline hover:bg-dl-line-soft"
      :class="isUrgent(item.key) ? 'border-dl-pending/35' : 'border-dl-line'"
    >
      <DlIcon :icon="ATTENTION_ICONS[item.key]" :size="18" :class="isUrgent(item.key) ? 'text-dl-pending' : 'text-dl-muted'" />
      {{ t(`central.attention.${item.key}`, { count: item.count }, item.count) }}
      <span class="font-semibold text-dl-cobalt">{{ t('central.attention.see') }} ›</span>
    </RouterLink>
  </div>
</template>
