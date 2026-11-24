<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchNotificationSettings, saveNotificationSettings, type NotificationCategory, type NotificationSetting } from '@/api/tenant/notifications'
import DlIcon from '@/components/DlIcon.vue'
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
 * Off = no new line of that kind; lines already received stay. Mockup: notifications-mockups/Notifications.html, frame 5.
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
    <div class="flex max-w-3xl flex-col gap-4">
      <p class="text-sm text-dl-muted">{{ t('notifications.settings.intro') }}</p>
      <DlSkeleton v-if="!events" class="h-80 rounded-3xl" />
      <section v-else class="flex flex-col rounded-3xl bg-dl-paper p-4 md:p-5">
        <template v-for="group in groups" :key="group.key">
          <h2 class="mt-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-dl-muted first:mt-0">
            <DlIcon :icon="CATEGORY_ICONS[group.key]" :size="15" /> {{ category(group.key) }}
          </h2>
          <div v-for="event in group.events" :key="event.key" class="flex items-center gap-3.5 border-b border-dl-line-soft py-3 last:border-b-0">
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
        </template>
      </section>
      <p class="text-xs text-dl-muted">{{ t('notifications.settings.hint') }}</p>
    </div>
  </StudioListPage>
</template>
