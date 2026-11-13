<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  DURATION_UNTIL,
  DURATION_HOURS,
  DURATIONS,
  createActivity,
  updateActivity,
  type Activity,
  type ActivityPayload,
} from '@/api/tenant/activities'
import { fetchActivityTypes, type ActivityType } from '@/api/tenant/fieldSetup'
import { rolesApi, type Role } from '@/api/tenant/roles'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useUsers } from '@/views/tenant/territories/useTerritoryLookups'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { today } from '@/views/tenant/users/userDisplay'
import { durationKey, KIND_TONE, kindOfType, useActivityText } from './activityDisplay'
import ActivityTargetsField from './ActivityTargetsField.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

// Add or edit an activity: for whom, type (only those allowed for that person's role), title,
// date and duration, what it is linked to, note. Someone of a field role adds only for themselves
// (decided 2026-11-12). Mockup: docs/design/plan-mockups/Activities.html
const props = defineProps<{ activity?: Activity | null }>()
const emit = defineEmits<{ saved: [activity: Activity] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useActivityText()
const toast = useToast()
const auth = useAuthStore()
const users = useUsers()
users.ensureLoaded()
const types = ref<ActivityType[]>([])
const roles = ref<Role[]>([])
onMountedAndFocus(async () => {
  const [typePage, roleRows] = await Promise.all([fetchActivityTypes({ per_page: 100, sort: 'activity', include: 'roles' }), rolesApi.list()])
  types.value = typePage.items
  roles.value = roleRows
})
/** A field role (VM, VP, KAM…) adds activities only for themselves. */
const onlyMe = computed(() => roles.value.some(role => role.name === auth.user?.role && role.is_field))

const isEdit = computed(() => !!props.activity)
const blank = () => ({
  user_id: (auth.user?.id as number | undefined) ?? null,
  activity_type_id: null as number | null,
  title: '',
  activity_date: today(),
  duration_type: 1,
  start_time: '09:00',
  end_time: '12:00',
  end_date: today(),
  observation: '',
  target_ids: [] as number[],
})
const form = reactive(blank())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const titleTouched = ref(false)

watch([open, () => props.activity], () => {
  if (!open.value) return
  Object.assign(form, blank())
  errors.value = {}
  titleTouched.value = false
  const activity = props.activity
  if (activity) {
    titleTouched.value = true
    Object.assign(form, {
      user_id: activity.user_id ?? activity.created_by ?? null,
      activity_type_id: activity.activity_type_id,
      title: activity.title,
      activity_date: activity.start_at?.slice(0, 10) ?? today(),
      duration_type: activity.duration_type,
      start_time: activity.start_at?.slice(11, 16) ?? '09:00',
      end_time: activity.end_at?.slice(11, 16) ?? '12:00',
      end_date: activity.end_at ? text.lastDay(activity) : today(),
      observation: activity.observation ?? '',
      target_ids: (activity.targets ?? []).map(target => target.target_id),
    })
  }
}, { immediate: true })

const person = computed(() => users.items.value.find(user => user.id === form.user_id))
const userOptions = computed(() => users.items.value
  .filter(user => user.is_active && (!onlyMe.value || user.id === auth.user?.id))
  .map(user => ({ value: user.id, label: user.id === auth.user?.id ? t('activities.form.me', { name: user.full_name }) : user.full_name }))
  .sort((a, b) => a.label.localeCompare(b.label)))
/** Types allowed for the person's role; a type with no role is open to everyone. */
const allowedTypes = computed(() => types.value.filter(type => {
  const names = (type.roles ?? []).map(role => role.name)
  return !names.length || (!!person.value?.role && names.includes(person.value.role))
}))
const typeOptions = computed(() => allowedTypes.value.map(type => ({ value: type.id, label: type.activity })).sort((a, b) => a.label.localeCompare(b.label)))
const type = computed(() => types.value.find(row => row.id === form.activity_type_id))
const kind = computed(() => kindOfType(type.value))

watch(() => form.activity_type_id, (id, before) => {
  if (!titleTouched.value && type.value) form.title = type.value.activity
  if (before && id !== before) form.target_ids = []
})
const durationOptions = computed(() => DURATIONS.map(row => ({ value: row.value, label: t(`activities.duration.${row.key}`) })))
const pickedTargets = computed(() => (props.activity?.targets ?? []).map(target => ({
  id: target.target_id,
  label: target.target?.full_name ?? target.target?.name ?? `#${target.target_id}`,
})))

/** "Its off-field days lower the field days of {name}'s cycle." */
const effect = computed(() => {
  if (!type.value) return ''
  const name = person.value?.full_name ?? ''
  if (kind.value === 'field') return t('activities.form.effectField')
  const half = ['morning', 'afternoon'].includes(durationKey(form.duration_type))
  return t(half ? 'activities.form.effectHalf' : 'activities.form.effectDays', { name, kind: text.kind(kind.value).toLowerCase() })
})

async function save() {
  errors.value = {}
  const found: Record<string, string> = {}
  if (!form.activity_type_id) found.activity_type_id = t('users.add.required')
  if (!form.title.trim()) found.title = t('users.add.required')
  if (Object.keys(found).length) {
    errors.value = found
    return
  }
  const payload: ActivityPayload = {
    user_id: form.user_id,
    activity_type_id: form.activity_type_id!,
    title: form.title.trim(),
    observation: form.observation.trim() || null,
    activity_date: form.activity_date,
    duration_type: form.duration_type,
    target_ids: form.target_ids,
    ...(form.duration_type === DURATION_HOURS ? { start_time: form.start_time, end_time: form.end_time } : {}),
    ...(form.duration_type === DURATION_UNTIL ? { end_date: form.end_date } : {}),
  }
  saving.value = true
  try {
    const saved = isEdit.value ? await updateActivity(props.activity!.id, payload) : await createActivity(payload)
    toast.success(t(isEdit.value ? 'studio.list.toast.saved' : 'activities.form.added'))
    emit('saved', saved)
  }
  catch (error) {
    // The API's messages come translated; a link's message shows under the links ("target_ids.2" → target_ids).
    errors.value = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, message]) => [key.split('.')[0], message]))
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="isEdit ? t('activities.form.editTitle') : t('activities.form.addTitle')">
    <form id="activity-form" class="flex flex-col gap-4" @submit.prevent="save">
      <DlCombobox v-model="form.user_id" :label="t('activities.form.for')" :options="userOptions" :hint="t('activities.form.forHint')" :error="errors.user_id || errors.period" :disabled="onlyMe" />
      <div class="flex flex-col gap-1.5">
        <DlCombobox v-model="form.activity_type_id" :label="t('activities.form.type')" :options="typeOptions" :error="errors.activity_type_id" />
        <span v-if="type" class="flex flex-wrap items-center gap-1.5 text-xs text-dl-muted">
          <DlBadge size="sm" :tone="KIND_TONE[kind]">{{ text.kind(kind) }}</DlBadge>
          {{ t('activities.form.typeHint', { role: roleLabel(person?.role) }) }}
        </span>
      </div>
      <DlInput v-model="form.title" :label="t('activities.form.title')" :error="errors.title" @input="titleTouched = true" />
      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.activity_date" type="date" :label="t('activities.form.date')" :error="errors.activity_date" />
        <DlSelect v-model="form.duration_type" :label="t('activities.form.duration')" :options="durationOptions" />
      </div>
      <div v-if="form.duration_type === DURATION_HOURS" class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.start_time" type="time" :label="t('activities.form.from')" :error="errors.start_time" />
        <DlInput v-model="form.end_time" type="time" :label="t('activities.form.to')" :error="errors.end_time" />
      </div>
      <DlInput v-if="form.duration_type === DURATION_UNTIL" v-model="form.end_date" type="date" :label="t('activities.form.until')" :error="errors.end_date" />
      <ActivityTargetsField v-if="type" v-model="form.target_ids" :value="String(type.value)" :picked="pickedTargets" :error="errors.target_ids" :date="form.activity_date" />
      <DlInput v-model="form.observation" :label="t('activities.form.note')" :placeholder="t('activities.form.optional')" />
      <p v-if="effect" class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ effect }}<template v-if="form.target_ids.length && type?.value === 'medical_representative' && kind !== 'field'"> {{ t('activities.form.repsToo', { count: n(form.target_ids.length) }, form.target_ids.length) }}</template></p>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="activity-form" variant="primary" class="ms-auto" :loading="saving">{{ isEdit ? t('geo.save') : t('activities.form.add') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
