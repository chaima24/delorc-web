<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { addHcpWorkplace, deleteHcpWorkplace, updateHcpWorkplace, type Hcp, type HcpWorkplace } from '@/api/tenant/hcps'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { today } from '@/views/tenant/users/userDisplay'
import HcpWorkplaceFields from './HcpWorkplaceFields.vue'
import { emptyWorkplace, useHcpText, type WorkplaceForm } from './hcpForm'

// "Works at": current workplaces, then past ones (greyed). In edit mode a workplace is ended
// (last day, it stays in the history), a new one added, one added by mistake deleted, or a
// current one made the main one ("Lieu principal": its speciality is the one the frequency grids use).
const props = defineProps<{ hcp: Hcp }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const text = useHcpText()

const editing = ref(false)
const isCurrent = (w: HcpWorkplace) => !w.end_date || w.end_date >= today()
const workplaces = computed(() =>
  [...(props.hcp.workplaces ?? [])].sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)) || (b.start_date ?? '').localeCompare(a.start_date ?? '')))
const when = (w: HcpWorkplace) => (w.end_date
  ? t('hcps.workplaces.between', { from: text.date(w.start_date), to: text.date(w.end_date) })
  : t('hcps.workplaces.sinceDate', { date: text.date(w.start_date) }))

const busy = ref(false)
const errors = ref<Record<string, string>>({})
function fail(error: unknown) {
  errors.value = fieldErrors(error)
  if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
}

// End one: its last day (today by default).
const ending = ref<number | null>(null)
const endDate = ref('')
function startEnd(w: HcpWorkplace) {
  adding.value = false
  errors.value = {}
  ending.value = w.id
  endDate.value = today()
}
async function end(w: HcpWorkplace) {
  if (!endDate.value) {
    errors.value = { end_date: t('users.add.required') }
    return
  }
  busy.value = true
  try {
    await updateHcpWorkplace(props.hcp.id, w.id, { end_date: endDate.value })
    toast.success(t('hcps.workplaces.ended'))
    ending.value = null
    emit('changed')
  }
  catch (error) {
    fail(error)
  }
  finally {
    busy.value = false
  }
}

// Add one.
const adding = ref(false)
const draft = ref<WorkplaceForm>(emptyWorkplace())
function startAdd() {
  ending.value = null
  errors.value = {}
  draft.value = { ...emptyWorkplace(), start_date: today() }
  adding.value = true
}
async function add() {
  errors.value = Object.fromEntries((['hco_id', 'speciality_id', 'start_date'] as const).filter(key => !draft.value[key]).map(key => [key, t('users.add.required')]))
  if (Object.keys(errors.value).length) return
  busy.value = true
  try {
    await addHcpWorkplace(props.hcp.id, { hco_id: draft.value.hco_id!, speciality_id: draft.value.speciality_id!, start_date: draft.value.start_date })
    toast.success(t('studio.list.toast.saved'))
    adding.value = false
    emit('changed')
  }
  catch (error) {
    fail(error)
  }
  finally {
    busy.value = false
  }
}

// Make a current one the main one: the other loses the mark.
async function makeMain(w: HcpWorkplace) {
  busy.value = true
  try {
    await updateHcpWorkplace(props.hcp.id, w.id, { is_main: true })
    toast.success(t('studio.list.toast.saved'))
    emit('changed')
  }
  catch (error) {
    fail(error)
  }
  finally {
    busy.value = false
  }
}

async function remove(w: HcpWorkplace) {
  const ok = await confirm({
    title: t('hcps.workplaces.deleteTitle', { name: w.hco?.name ?? '' }),
    text: t('hcps.workplaces.deleteText'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteHcpWorkplace(props.hcp.id, w.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('changed')
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}

function done() {
  editing.value = false
  adding.value = false
  ending.value = null
  errors.value = {}
}
</script>

<template>
  <section class="rounded-2xl border bg-dl-paper" :class="editing ? 'border-2 border-dl-fg' : 'border-dl-line'" :aria-label="t('hcps.read.worksAt')">
    <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" :class="editing ? 'bg-dl-ink text-dl-signal' : 'bg-dl-line-soft text-dl-body'">
        <DlIcon icon="tabler-building-hospital" :size="17" />
      </span>
      <h3 class="flex-1 text-sm font-semibold">{{ t('hcps.read.worksAt') }}</h3>
      <DlButton v-if="canUpdate('hcps') && !editing" variant="outline" size="sm" icon="tabler-pencil" @click="editing = true">{{ t('common.actions.edit') }}</DlButton>
      <DlButton v-else-if="editing" variant="dark" size="sm" @click="done">{{ t('hcps.workplaces.done') }}</DlButton>
    </header>

    <ul v-if="workplaces.length" class="flex flex-col pb-2">
      <li v-for="(w, index) in workplaces" :key="w.id" class="flex flex-col gap-2 px-3.5 py-2.5 text-[13px]" :class="index ? 'border-t border-dl-line-soft' : ''">
        <div class="flex items-start gap-3">
          <span class="w-1 self-stretch rounded-full" :class="isCurrent(w) ? 'bg-dl-cobalt' : 'bg-dl-line'" aria-hidden="true" />
          <span class="flex min-w-0 flex-1 flex-col" :class="!isCurrent(w) && 'text-dl-muted'">
            <span class="flex flex-wrap items-center gap-1.5">
              <span class="font-semibold">{{ w.hco?.name ?? '—' }}</span>
              <DlBadge v-if="w.is_main" size="sm" tone="info">{{ t('hcps.workplaces.main') }}</DlBadge>
            </span>
            <span class="text-xs text-dl-muted">{{ w.speciality?.name ?? '—' }} · {{ when(w) }}</span>
          </span>
          <template v-if="editing && ending !== w.id">
            <DlButton v-if="isCurrent(w) && !w.is_main" variant="ghost" size="sm" :loading="busy" @click="makeMain(w)">{{ t('hcps.workplaces.makeMain') }}</DlButton>
            <DlButton v-if="isCurrent(w) && !w.end_date" variant="outline" size="sm" @click="startEnd(w)">{{ t('hcps.workplaces.end') }}</DlButton>
            <button type="button" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-dl-muted hover:bg-dl-line-soft hover:text-dl-rejected" :aria-label="t('hcps.workplaces.deleteTitle', { name: w.hco?.name ?? '' })" @click="remove(w)">
              <DlIcon icon="tabler-trash" :size="16" />
            </button>
          </template>
        </div>
        <form v-if="editing && ending === w.id" class="ms-4 flex flex-col gap-2 rounded-xl border border-dl-line p-3" @submit.prevent="end(w)">
          <DlInput v-model="endDate" type="date" :min="w.start_date ?? undefined" :label="t('hcps.workplaces.lastDay')" :hint="t('hcps.workplaces.lastDayHint')" :error="errors.end_date" />
          <div class="flex justify-end gap-2">
            <DlButton variant="outline" size="sm" @click="ending = null">{{ t('common.actions.cancel') }}</DlButton>
            <DlButton type="submit" variant="dark" size="sm" :loading="busy">{{ t('hcps.workplaces.end') }}</DlButton>
          </div>
        </form>
      </li>
    </ul>
    <p v-else-if="!adding" class="px-3.5 pb-3 text-[13px] text-dl-muted">{{ t('hcps.workplaces.none') }}</p>

    <div v-if="editing" class="flex flex-col gap-3 px-3.5 pb-3.5">
      <form v-if="adding" class="flex flex-col gap-3 rounded-xl border border-dl-line p-3" @submit.prevent="add">
        <HcpWorkplaceFields v-model:form="draft" :errors="errors" />
        <div class="flex justify-end gap-2">
          <DlButton variant="outline" size="sm" @click="adding = false">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" variant="dark" size="sm" :loading="busy">{{ t('hcps.workplaces.add') }}</DlButton>
        </div>
      </form>
      <DlButton v-else variant="outline" size="sm" icon="tabler-plus" class="self-start" @click="startAdd">{{ t('hcps.workplaces.add') }}</DlButton>
    </div>
  </section>
</template>
