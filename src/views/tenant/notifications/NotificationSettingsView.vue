<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchNotificationSettings, saveNotificationSettings, type NotificationCategory, type NotificationSetting } from '@/api/tenant/notifications'
import DlIcon from '@/components/DlIcon.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { fieldSection } from '@/views/tenant/settings/shared/studioSections'
import { CATEGORY_ICONS, useNotificationText } from './notificationText'

/**
 * Studio › Configuration terrain › Notifications (admins): one switch per event, for the whole lab, saved at once.
 * The groups on the left (a select on a phone) with how many are on, the chosen group's switches on the right.
 * Off = no new line of that kind; lines already received stay. Mockup: notifications-mockups/Notifications.html, frames 13–14.
 */
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const { category } = useNotificationText()
const canEdit = computed(() => auth.can('notification-settings.update'))

const events = ref<NotificationSetting[] | null>(null)
onMountedAndFocus(async () => { events.value = await fetchNotificationSettings() })

const groups = computed(() => {
  const out: { key: NotificationCategory; events: NotificationSetting[] }[] = []
  for (const event of events.value ?? []) {
    const group = out.find(row => row.key === event.category)
    if (group) group.events.push(event)
    else out.push({ key: event.category, events: [event] })
  }
  return out
})
// The group on screen: the first one until another is chosen.
const chosen = ref<NotificationCategory | null>(null)
const current = computed(() => groups.value.find(group => group.key === chosen.value) ?? groups.value[0])
const choice = computed({ get: () => current.value?.key ?? null, set: value => { chosen.value = value as NotificationCategory | null } })
const onCount = (group: { events: NotificationSetting[] }) => `${group.events.filter(event => event.enabled).length} / ${group.events.length}`
const options = computed(() => groups.value.map(group => ({ value: group.key, label: `${category(group.key)} · ${onCount(group)}` })))
// `visit_plan.sent` → `visit_plan_sent`: a text key part can't hold a dot.
const textKey = (event: NotificationSetting) => event.key.replace('.', '_')

async function toggle(event: NotificationSetting, enabled: boolean): Promise<void> {
  try {
    events.value = await saveNotificationSettings([{ key: event.key, enabled }])
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <StudioListPage :section="fieldSection" :title="t('notifications.settings.title')">
    <div class="flex w-full flex-col gap-4">
      <p class="text-sm text-dl-muted">{{ t('notifications.settings.intro') }}</p>
      <DlSkeleton v-if="!events" class="h-80 rounded-3xl" />
      <div v-else-if="current" class="flex flex-col gap-4 md:flex-row md:items-start">
        <DlSelect v-model="choice" class="md:hidden" :label="t('notifications.page.group')" :options="options" hide-label />
        <nav :aria-label="t('notifications.page.group')" class="hidden w-72 shrink-0 flex-col gap-0.5 rounded-3xl bg-dl-paper p-2 md:flex">
          <button
            v-for="group in groups"
            :key="group.key"
            type="button"
            :aria-current="group.key === current.key ? 'true' : undefined"
            class="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-start text-sm font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            :class="group.key === current.key ? 'bg-dl-ink text-dl-on-ink' : 'text-dl-fg hover:bg-dl-line-soft'"
            @click="chosen = group.key"
          >
            <DlIcon :icon="CATEGORY_ICONS[group.key]" :size="18" />
            <span class="min-w-0 flex-1">{{ category(group.key) }}</span>
            <span class="text-xs font-medium tabular-nums" :class="group.key === current.key ? 'text-dl-on-ink-muted' : 'text-dl-muted'">{{ onCount(group) }}</span>
          </button>
        </nav>
        <section class="flex min-w-0 flex-1 flex-col rounded-3xl bg-dl-paper p-4 md:p-5">
          <h2 class="font-display text-xl font-extrabold">{{ category(current.key) }}</h2>
          <div v-for="event in current.events" :key="event.key" class="flex items-center gap-3.5 border-b border-dl-line-soft py-3 last:border-b-0">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <strong class="text-sm">{{ t(`notifications.settings.event.${textKey(event)}`) }}</strong>
              <span class="text-[12.5px] text-dl-muted">{{ t('notifications.settings.to', { who: t(`notifications.settings.who.${textKey(event)}`) }) }}</span>
            </div>
            <DlSwitch
              :model-value="event.enabled"
              :label="event.enabled ? t('notifications.settings.on') : t('notifications.settings.off')"
              :class="!canEdit && 'pointer-events-none opacity-60'"
              @update:model-value="value => toggle(event, value)"
            />
          </div>
        </section>
      </div>
      <p class="text-xs text-dl-muted">{{ t('notifications.settings.hint') }}</p>
    </div>
  </StudioListPage>
</template>
