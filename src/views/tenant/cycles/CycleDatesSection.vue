<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { updateCycleDates, type CycleDetail } from '@/api/tenant/cycles'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useCycleText } from './cycleDisplay'

// The cycle's dates, changed in place. Refused when they overlap another cycle of the person (and, with visits,
// when a recorded visit falls outside) (docs/api/cycles.md).
const props = defineProps<{ cycle: CycleDetail }>()
const emit = defineEmits<{ saved: [cycle: CycleDetail] }>()
const { t, n } = useI18n()
const text = useCycleText()
const toast = useToast()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)

const editing = ref(false)
const saving = ref(false)
const form = reactive({ start: '', end: '' })
const errors = ref<Record<string, string>>({})
function reset() {
  Object.assign(form, { start: props.cycle.start_date, end: props.cycle.end_date })
  errors.value = {}
}
watch(() => props.cycle, reset, { immediate: true })

async function save() {
  saving.value = true
  errors.value = {}
  try {
    const cycle = await updateCycleDates(props.cycle.id, { start_date: form.start, end_date: form.end })
    toast.success(t('studio.list.toast.saved'))
    editing.value = false
    emit('saved', cycle)
  }
  catch (error) {
    // The API's messages come translated.
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
function cancel() {
  editing.value = false
  reset()
}
</script>

<template>
  <DlRecordSection
    v-model:editing="editing"
    :title="t('cycles.dates.title')"
    :can-edit="canUpdate('cycles')"
    :saving="saving"
    @save="save"
    @cancel="cancel"
  >
    <dl class="grid grid-cols-[120px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
      <dt class="text-dl-muted">{{ t('cycles.dates.period') }}</dt><dd>{{ text.period(cycle.start_date, cycle.end_date) }}</dd>
      <dt class="text-dl-muted">{{ t('cycles.dates.workingDays') }}</dt><dd>{{ n(cycle.working_days) }} <span class="text-xs text-dl-muted">· {{ t('cycles.dates.workingHint') }}</span></dd>
    </dl>
    <template #edit>
      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.start" type="date" :label="t('cycles.dates.start')" :error="errors.start_date" />
        <DlInput v-model="form.end" type="date" :min="form.start" :label="t('cycles.dates.end')" :error="errors.end_date" />
      </div>
      <p class="text-xs text-dl-muted">{{ t('cycles.dates.hint') }}</p>
    </template>
  </DlRecordSection>
</template>
