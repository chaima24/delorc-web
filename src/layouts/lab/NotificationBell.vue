<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type LabNotification } from '@/api/tenant/notifications'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useNotificationStore } from '@/stores/notifications'
import NotificationLine from '@/views/tenant/notifications/NotificationLine.vue'

/**
 * The lab's bell (delorc-api docs/api/notifications.md): the red number of unread lines (asked every minute by the
 * store), and on click the 10 latest lines. A click on a line marks it read and opens its page.
 * Mockup: docs/design/notifications-mockups/Notifications.html, frames 1–3.
 */
const { t } = useI18n()
const store = useNotificationStore()
const open = ref(false)
const lines = ref<LabNotification[] | null>(null)

// The panel asks for its lines each time it opens; opening it reads nothing.
watch(open, async (value) => {
  if (!value) return
  lines.value = null
  lines.value = (await fetchNotifications({}, 1, 10)).items
  store.load()
})

async function openLine(line: LabNotification): Promise<void> {
  open.value = false
  if (!line.read_at) {
    await markNotificationRead(line.id).catch(() => undefined)
    store.load()
  }
}

async function readAll(): Promise<void> {
  await markAllNotificationsRead()
  lines.value = (lines.value ?? []).map(line => ({ ...line, read_at: line.read_at ?? new Date().toISOString() }))
  store.load()
}

defineProps<{ trigger: string; menu: string }>()
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :aria-label="store.unread ? t('notifications.bellUnread', { count: store.unread }, store.unread) : t('layout.topbar.notifications')"
        :class="[trigger, 'relative w-11', open && 'border-dl-signal bg-dl-signal text-dl-ink hover:bg-dl-signal']"
      >
        <DlIcon icon="tabler-bell" :size="20" />
        <span v-if="store.unread" class="absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-dl-rejected px-1 text-[11px] font-bold text-white">
          {{ store.unread > 9 ? '9+' : store.unread }}
        </span>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent align="end" :side-offset="8" :class="[menu, 'flex max-h-[min(640px,calc(100vh-96px))] w-[440px] max-w-[calc(100vw-32px)] flex-col p-0']">
        <header class="flex items-center gap-2.5 px-4 pb-2.5 pt-3.5">
          <p class="text-[15px] font-semibold">{{ t('layout.topbar.notifications') }}</p>
          <DlButton v-if="store.unread" size="sm" variant="ghost" class="ms-auto" @click="readAll">{{ t('notifications.readAll') }}</DlButton>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div v-if="!lines" class="flex flex-col gap-2 px-4 pb-3"><DlSkeleton v-for="i in 3" :key="i" class="h-12 rounded-xl" /></div>
          <div v-else-if="!lines.length" class="flex flex-col items-center gap-1.5 border-t border-dl-line-soft px-4 py-9 text-center text-sm text-dl-muted">
            <DlIcon icon="tabler-bell" :size="26" />
            <strong class="text-dl-fg">{{ t('layout.topbar.nothing') }}</strong>
            {{ t('notifications.nothingHint') }}
          </div>
          <div v-else class="border-t border-dl-line-soft">
            <NotificationLine v-for="line in lines" :key="line.id" :line="line" @open="openLine" />
          </div>
        </div>
        <footer class="flex justify-center border-t border-dl-line-soft px-4 py-3">
          <DlButton size="sm" variant="outline" :to="{ name: 'tenant-notifications' }" @click="open = false">{{ t('notifications.seeAll') }}</DlButton>
        </footer>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
