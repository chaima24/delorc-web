<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { deleteActivity, type Activity } from '@/api/tenant/activities'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useUserText } from '@/views/tenant/users/userDisplay'
import { KIND_TONE, useActivityText } from './activityDisplay'

// An activity in the side panel: when, who (and the reps it covers), what it does to the cycle,
// what it is linked to, note. Edit opens the form; delete asks first. The cycle line ("Dans son cycle") comes with cycles.
const props = defineProps<{ activity: Activity }>()
const emit = defineEmits<{ edit: []; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useActivityText()
const dates = useUserText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const canDelete = (resource: string) => auth.can(`${resource}.delete`)

const kind = computed(() => props.activity.kind ?? 'field')
const targets = computed(() => (props.activity.targets ?? []).map(target => {
  return target.target?.full_name ?? target.target?.name ?? `#${target.target_id}`
}))
const coversReps = computed(() => props.activity.activity_type?.value === 'medical_representative' && targets.value.length > 0)
const effect = computed(() => {
  const days = props.activity.days ?? 0
  if (kind.value === 'field') return t('activities.read.effectField')
  return t('activities.read.effect', { days: t('activities.daysCount', { count: n(days) }, Math.ceil(days)), kind: text.kind(kind.value).toLowerCase() })
})
const menuItems = computed(() => canDelete('activities') ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }] : [])

async function remove() {
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: props.activity.title }),
    text: t('activities.read.deleteText'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteActivity(props.activity.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="activity.title">
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-dl-muted">
        <DlBadge size="sm" :tone="KIND_TONE[kind]">{{ text.kind(kind) }}</DlBadge>
        {{ activity.activity_type?.activity }}
      </span>
    </template>
    <template #actions>
      <DlButton v-if="canUpdate('activities')" variant="outline" size="sm" icon="tabler-pencil" @click="emit('edit')">{{ t('activities.read.edit') }}</DlButton>
      <DlMenu v-if="menuItems.length" :label="t('fieldSetup.menu.label')" :items="menuItems" />
    </template>

    <div class="flex flex-col gap-3.5 text-[13px]">
      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('activities.read.when') }}</h3>
        <dl class="grid grid-cols-[100px_1fr] gap-x-2.5 gap-y-1.5">
          <dt class="text-dl-muted">{{ t('activities.form.date') }}</dt>
          <dd>{{ activity.start_at ? text.day(activity.start_at, true) : '—' }}<template v-if="activity.end_at && text.lastDay(activity) !== activity.start_at?.slice(0, 10)"> → {{ text.day(text.lastDay(activity), true) }}</template></dd>
          <dt class="text-dl-muted">{{ t('activities.form.duration') }}</dt>
          <dd>{{ text.when(activity) }} <span class="text-dl-muted">· {{ t('activities.workingDays', { count: n(activity.days ?? 0) }, Math.ceil(activity.days ?? 0)) }}</span></dd>
        </dl>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-2 text-sm font-semibold">{{ t('activities.read.who') }}</h3>
        <p v-if="activity.user" class="flex items-center gap-2.5">
          <DlAvatar :name="activity.user.full_name" size="sm" />
          <span class="flex flex-col"><strong class="font-semibold">{{ activity.user.full_name }}</strong><span class="text-xs text-dl-muted">{{ roleLabel(activity.user.role) }}</span></span>
        </p>
        <p v-if="coversReps" class="mt-2 text-dl-body">{{ t('activities.read.withReps', { names: targets.join(', ') }) }}</p>
        <p class="mt-2 rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ effect }}<template v-if="coversReps && kind !== 'field'"> {{ t('activities.read.repsToo') }}</template></p>
      </section>

      <section v-if="targets.length && !coversReps" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t(`activities.linked.${activity.activity_type?.value}`) }}</h3>
        <p class="text-dl-body">{{ targets.join(', ') }}</p>
      </section>

      <section v-if="activity.observation" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('activities.form.note') }}</h3>
        <p class="whitespace-pre-line text-dl-body">{{ activity.observation }}</p>
      </section>

      <p class="text-xs text-dl-muted">{{ t('activities.read.addedBy', { name: activity.created_by?.full_name ?? '—', date: dates.date(activity.created_at) }) }}</p>
    </div>
  </DlRecordPanel>
</template>
