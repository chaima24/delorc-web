<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { syncUserManagers, type TenantUser } from '@/api/tenant/users'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useToast } from '@/composables/useToast'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { currentManagers, today, useUserText } from '../userDisplay'
import { peopleUnder } from './orgTree'
import { useOrgTree } from './useOrgTree'

// Gives a person a new manager from a date: either in place of a current one (that link ends the
// day before) or as another manager (both stay). Used by drag and drop and by "Change manager".
const props = defineProps<{
  user: TenantUser
  /** New manager already chosen (drag and drop). */
  managerId?: number | null
  /** Dragged from under this manager: that is the one being replaced. */
  fromManagerId?: number | null
}>()
const emit = defineEmits<{ done: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useUserText()
const { people, tree, refresh } = useOrgTree()

const managerId = ref<number | null>(null)
const mode = ref<'replace' | 'add'>('replace')
/** The current manager being replaced. */
const replacing = ref<number | null>(null)
const date = ref(today())
/** Optional last day of the new link. */
const until = ref('')
const error = ref<string | null>(null)
const saving = ref(false)

const currents = computed(() => currentManagers(props.user))
const current = computed(() => (mode.value === 'replace' ? currents.value.find(manager => manager.id === replacing.value) ?? null : null))
const modeItems = computed(() => [
  { value: 'replace', label: t('users.hierarchy.replace') },
  { value: 'add', label: t('users.hierarchy.addAnother') },
])
const currentOptions = computed(() => currents.value.map(manager => ({ value: manager.id, label: manager.name })))
watch([open, () => props.managerId], () => {
  if (!open.value) return
  managerId.value = props.managerId ?? null
  // Nothing is guessed: a drag replaces the manager it was dragged from; with one manager,
  // that one; with several, the admin picks; with none, the new one is simply added.
  mode.value = currents.value.length ? 'replace' : 'add'
  replacing.value = props.fromManagerId ?? (currents.value.length === 1 ? currents.value[0]!.id : null)
  date.value = today()
  until.value = ''
  error.value = null
}, { immediate: true })
const under = computed(() => peopleUnder(tree.value, props.user.id))
const options = computed(() => people.items.value
  .filter(person => person.is_active && person.id !== props.user.id && !currents.value.some(manager => manager.id === person.id))
  .map(person => ({ value: person.id, label: person.full_name, hint: roleLabel(person.role) }))
  .sort((a, b) => a.label.localeCompare(b.label)))
const target = computed(() => tree.value.byId.get(managerId.value ?? -1) ?? null)
const loop = computed(() => !!managerId.value && under.value.has(managerId.value))

function dayBefore(value: string) {
  const day = new Date(`${value}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}
const hint = computed(() => (mode.value === 'add' ? t('users.hierarchy.addHint') : current.value && date.value
  ? t('users.hierarchy.endsBefore', { name: current.value.name, date: text.date(dayBefore(date.value)) })
  : undefined))

async function save() {
  if (!managerId.value || loop.value || (mode.value === 'replace' && !current.value)) return
  saving.value = true
  error.value = null
  try {
    // The current link ends the day before (never before its own start).
    const ending = current.value
    const endDate = ending ? [dayBefore(date.value), ending.start ?? ''].sort().pop()! : ''
    await syncUserManagers(props.user.id, {
      existing_managers: ending ? [{ id: ending.id, end_date: endDate }] : [],
      new_managers: [{ id: managerId.value, start_date: date.value, end_date: until.value || null }],
    })
    toast.success(t(mode.value === 'add' ? 'users.hierarchy.added' : 'users.hierarchy.moved', { name: props.user.first_name, manager: target.value?.full_name ?? '' }))
    open.value = false
    refresh()
    emit('done')
  }
  catch (err) {
    error.value = Object.values(fieldErrors(err))[0] ?? errorMessage(err) ?? t('studio.list.toast.failed')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('users.hierarchy.change')" :description="user.full_name">
    <form id="change-manager" class="flex flex-col gap-3.5" novalidate @submit.prevent="save">
      <DlSegmented v-if="currents.length" v-model="mode" :label="t('users.hierarchy.change')" :items="modeItems" block />
      <DlSelect v-if="mode === 'replace' && currents.length > 1" v-model="replacing" :label="t('users.hierarchy.replacing')" :options="currentOptions" />
      <p class="flex flex-wrap items-center gap-2 text-[13px]">
        <template v-if="mode === 'replace'">
          <DlBadge size="sm">{{ current?.name ?? t('users.hierarchy.noManager') }}</DlBadge>
          <DlIcon icon="tabler-arrow-right" :size="16" class="text-dl-muted rtl:-scale-x-100" />
        </template>
        <template v-else>
          <DlBadge v-for="manager in currents" :key="manager.id" size="sm">{{ manager.name }}</DlBadge>
          <span class="font-semibold text-dl-muted">＋</span>
        </template>
        <DlBadge size="sm" tone="signal">{{ target?.full_name ?? '…' }}</DlBadge>
      </p>
      <DlCombobox
        v-model="managerId"
        :label="t('users.hierarchy.newManager')"
        :options="options"
        :error="loop ? t('users.hierarchy.loop', { name: user.first_name }) : undefined"
      />
      <DlInput v-model="date" type="date" :label="t('users.assign.from')" :hint="hint" />
      <DlInput v-model="until" type="date" :min="date" :label="t('users.assign.until')" :hint="t('users.assign.untilHint')" />
      <p v-if="error" class="text-xs text-dl-rejected" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="change-manager" variant="primary" class="ms-auto" :loading="saving" :disabled="!managerId || loop || (mode === 'replace' && !current)">
        {{ mode === 'add' ? t('users.hierarchy.addButton') : t('users.hierarchy.move', { name: user.first_name }) }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>
