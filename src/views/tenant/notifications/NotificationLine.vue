<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LabNotification } from '@/api/tenant/notifications'
import DlIcon from '@/components/DlIcon.vue'
import { CATEGORY_ICONS, notificationLink, useNotificationText } from './notificationText'

/**
 * One line of the bell or of the Notifications page: group icon, sentence, group · when, the unread dot.
 * A click opens the target (the parent marks it read); on the page a read line offers « Marquer comme non lu ».
 */
defineProps<{ line: LabNotification; onPage?: boolean }>()
const emit = defineEmits<{ open: [line: LabNotification]; unread: [line: LabNotification] }>()
const { t } = useI18n()
const { sentence, when, category } = useNotificationText()
</script>

<template>
  <div class="flex items-start gap-3 border-t border-dl-line-soft py-3 first:border-t-0" :class="[onPage ? 'px-1' : 'px-4', !line.read_at && 'bg-dl-signal/15']">
    <RouterLink :to="notificationLink(line)" class="flex min-w-0 flex-1 items-start gap-3 text-dl-fg no-underline" @click="emit('open', line)">
      <span class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-dl-mist text-dl-ink" :title="category(line.category)">
        <DlIcon :icon="CATEGORY_ICONS[line.category]" :size="18" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5 text-[13.5px] leading-snug">
        <span>{{ sentence(line) }}</span>
        <span class="text-xs text-dl-muted">{{ category(line.category) }} · {{ when(line) }}</span>
      </span>
    </RouterLink>
    <span v-if="!line.read_at" class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-dl-rejected" :aria-label="t('notifications.unreadDot')" />
    <button v-else-if="onPage" type="button" class="shrink-0 whitespace-nowrap text-xs text-dl-muted underline hover:text-dl-fg" @click="emit('unread', line)">
      {{ t('notifications.markUnread') }}
    </button>
  </div>
</template>
