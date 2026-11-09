<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldErrors } from '@/api/errors'
import { deleteHoliday, updateHoliday, type Holiday } from '@/api/tenant/fieldSetup'
import DlBadge from '@/components/DlBadge.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu, { type DlMenuItem } from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useHolidayText } from './holidayDisplay'

// A holiday in the side panel: name, date, every year, and what it changes.
// Mockup: docs/design/studio-mockups/Holidays.html (frame 2)
const props = defineProps<{ holiday: Holiday }>()
const emit = defineEmits<{ changed: [holiday: Holiday]; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n, d } = useI18n()
const text = useHolidayText()

const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()

const editing = ref(false)
const form = reactive({ name: '', date: '', every_year: false })
const errors = ref<Record<string, string>>({})
const saving = ref(false)

function resetForm() {
  Object.assign(form, { name: props.holiday.name, date: props.holiday.date, every_year: props.holiday.every_year })
  errors.value = {}
}
watch(() => props.holiday, resetForm, { immediate: true })
watch(() => props.holiday.id, () => { editing.value = false })

async function save() {
  if (!form.name.trim() || !form.date) {
    errors.value = { ...(!form.name.trim() && { name: t('users.add.required') }), ...(!form.date && { date: t('users.add.required') }) }
    return
  }
  saving.value = true
  errors.value = {}
  try {
    const holiday = await updateHoliday(props.holiday.id, { name: form.name.trim(), date: form.date, every_year: form.every_year })
    toast.success(t('studio.list.toast.saved'))
    editing.value = false
    emit('changed', holiday)
  }
  catch (error) {
    errors.value = fieldErrors(error) // already translated by the API
    if (Object.keys(errors.value).length) return
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
function cancel() {
  editing.value = false
  resetForm()
}

async function remove() {
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: props.holiday.name }),
    text: t('holidays.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteHoliday(props.holiday.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
const menuItems = computed<DlMenuItem[]>(() =>
  auth.can('holidays.delete') ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }] : [])

const impact = computed(() => props.holiday.impact)
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="holiday.name">
    <template #badges>
      <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
        <DlBadge v-if="holiday.on_weekend" size="sm">{{ t('holidays.effect.weekend') }}</DlBadge>
        <DlBadge v-else size="sm" tone="signal">{{ t('holidays.effect.dayOff') }}</DlBadge>
        <DlBadge v-if="holiday.every_year" size="sm" icon="tabler-repeat">{{ t('holidays.everyYear.yesLong') }}</DlBadge>
      </span>
    </template>
    <template v-if="menuItems.length" #actions>
      <DlMenu :label="t('fieldSetup.menu.label')" :items="menuItems" />
    </template>

    <div class="flex flex-col gap-3.5">
      <DlRecordSection
        v-model:editing="editing"
        :title="t('holidays.read.holiday')"
        :can-edit="auth.can('holidays.update')"
        :saving="saving"
        @save="save"
        @cancel="cancel"
      >
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('holidays.fields.name') }}</dt><dd>{{ holiday.name }}</dd>
          <dt class="text-dl-muted">{{ t('holidays.fields.date') }}</dt><dd>{{ text.long(holiday.date) }}</dd>
          <dt class="text-dl-muted">{{ t('holidays.columns.everyYear') }}</dt>
          <dd>{{ holiday.every_year ? t('holidays.read.everyYearYes', { year: Number(holiday.date.slice(0, 4)) }) : t('holidays.read.everyYearNo') }}</dd>
        </dl>
        <template #edit>
          <div class="flex flex-col gap-3">
            <DlInput v-model="form.name" :label="t('holidays.fields.name')" :error="errors.name" />
            <DlInput v-model="form.date" type="date" :label="t('holidays.fields.date')" :error="errors.date" />
            <label class="flex items-center gap-2.5 text-[13px]">
              <input v-model="form.every_year" type="checkbox" class="h-[18px] w-[18px] accent-dl-ink">
              {{ t('holidays.fields.everyYear') }}
            </label>
          </div>
        </template>
      </DlRecordSection>

      <section v-if="impact" class="rounded-2xl border border-dl-line px-3.5 py-3" :aria-label="t('holidays.read.changes')">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('holidays.read.changes') }}</h3>
        <p v-if="impact.on_weekend" class="text-[13px] text-dl-body">{{ t('holidays.read.onWeekend') }}</p>
        <template v-else>
          <p class="text-[13px] text-dl-body">
            {{ t('holidays.read.month', { month: text.monthYear(impact.month), days: n(impact.working_days), without: n(impact.working_days_without) }) }}
          </p>
          <p class="mt-1.5 text-[13px] text-dl-body">{{ t('holidays.read.cycles', impact.cycles) }}</p>
        </template>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('holidays.read.details') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('holidays.read.addedBy') }}</dt>
          <dd>{{ holiday.creator?.name ?? '—' }} · {{ holiday.created_at ? d(new Date(holiday.created_at), { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}</dd>
        </dl>
      </section>
    </div>
  </DlRecordPanel>
</template>
