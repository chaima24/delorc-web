<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import {
  fetchNotifications, markAllNotificationsRead, NOTIFICATION_CATEGORIES, markNotificationRead, markNotificationUnread,
  type LabNotification, type NotificationCategory, type NotificationCounts,
} from '@/api/tenant/notifications'
import DlButton from '@/components/DlButton.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import NotificationLine from './NotificationLine.vue'
import { useNotificationText } from './notificationText'

/**
 * Notifications (« Tout voir » from the bell): every line of the person, newest first, 20 at a time with « Voir plus ».
 * Filters: read / unread, group, dates. Mockup: docs/design/notifications-mockups/Notifications.html, frame 4.
 */
const { t } = useI18n()
const toast = useToast()
const store = useNotificationStore()
const auth = useAuthStore()
const { category } = useNotificationText()

const read = ref('all') // all · 0 (unread) · 1 (read)
const group = ref<NotificationCategory | null>(null)
const from = ref('')
const to = ref('')
const lines = ref<LabNotification[] | null>(null)
const counts = ref<NotificationCounts>({ all: 0, unread: 0, read: 0 })
const page = ref(1)
const lastPage = ref(1)
const loadingMore = ref(false)

const filters = computed(() => ({
  read: read.value === 'all' ? undefined : (read.value as '0' | '1'),
  category: group.value ?? undefined,
  from: from.value || undefined,
  to: to.value || undefined,
}))
const readItems = computed(() => [
  { value: 'all', label: t('notifications.page.all', { count: counts.value.all }) },
  { value: '0', label: t('notifications.page.unread', { count: counts.value.unread }) },
  { value: '1', label: t('notifications.page.read', { count: counts.value.read }) },
])
// Frais, Commandes, Veille, Réclamations and Enquêtes only when the lab has the module, like Studio.
const PLAN_SWITCH: Partial<Record<NotificationCategory, string>> = {
  expenses: 'module.expenses', orders: 'module.orders', competitive: 'module.competitive', complaints: 'module.complaints', surveys: 'module.surveys',
}
const groups = computed(() => NOTIFICATION_CATEGORIES
  .filter(key => !PLAN_SWITCH[key] || auth.hasFeature(PLAN_SWITCH[key]))
  .map(key => ({ value: key, label: category(key) })))
const groupModel = computed({ get: () => group.value, set: value => { group.value = (value as NotificationCategory | null) ?? null } })

/** The first page again (on open, a filter, the tab's focus); the pages already loaded are dropped. */
async function load(): Promise<void> {
  const result = await fetchNotifications(filters.value, 1)
  lines.value = result.items
  counts.value = result.counts
  page.value = 1
  lastPage.value = result.lastPage
}
onMountedAndFocus(load)
watch(filters, load)

async function more(): Promise<void> {
  loadingMore.value = true
  try {
    const result = await fetchNotifications(filters.value, page.value + 1)
    lines.value = [...(lines.value ?? []), ...result.items]
    page.value += 1
    lastPage.value = result.lastPage
  }
  finally {
    loadingMore.value = false
  }
}

async function run(action: () => Promise<unknown>): Promise<void> {
  try {
    await action()
    await load()
    store.load()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const openLine = (line: LabNotification) => (line.read_at ? undefined : run(() => markNotificationRead(line.id)))
const unread = (line: LabNotification) => run(() => markNotificationUnread(line.id))
const readAll = () => run(markAllNotificationsRead)
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <div class="flex min-w-0 flex-col gap-1.5">
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('layout.topbar.notifications') }}</h1>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <DlSegmented v-model="read" :label="t('notifications.page.readFilter')" :items="readItems" />
      <div class="w-48"><DlSelect v-model="groupModel" :label="t('notifications.page.group')" :options="groups" :placeholder="t('notifications.page.allGroups')" appearance="filter" hide-label /></div>
      <div class="w-64"><DlDateRangePicker v-model:start="from" v-model:end="to" :label="t('notifications.page.dates')" hide-label clearable /></div>
      <DlButton v-if="counts.unread" variant="ghost" class="ms-auto" @click="readAll">{{ t('notifications.readAll') }}</DlButton>
    </div>

    <DlSkeleton v-if="!lines" class="h-72 rounded-3xl" />
    <DlEmptyState v-else-if="!lines.length" icon="tabler-bell" :title="t('layout.topbar.nothing')" :description="t('notifications.nothingHint')" />
    <section v-else class="rounded-3xl bg-dl-paper px-3 py-1 md:px-5">
      <NotificationLine v-for="line in lines" :key="line.id" :line="line" on-page @open="openLine" @unread="unread" />
    </section>

    <DlButton v-if="lines && page < lastPage" variant="outline" class="self-center" :loading="loadingMore" @click="more">{{ t('notifications.page.more') }}</DlButton>
    <p class="text-center text-xs text-dl-muted">{{ t('notifications.page.kept') }}</p>
  </div>
</template>
