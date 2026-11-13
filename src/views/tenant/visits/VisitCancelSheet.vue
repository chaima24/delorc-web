<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchCancelReasons, type CancelReason } from '@/api/tenant/fieldSetup'
import { cancelVisit, type Visit } from '@/api/tenant/visits'
import DlButton from '@/components/DlButton.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { useVisitText } from './visitDisplay'

// "Annuler la visite": a reason from the Studio list is required. Mockup: visits-mockups/Visits.html (frame 7)
const props = defineProps<{ visit: Visit }>()
const emit = defineEmits<{ cancelled: [visit: Visit] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = useVisitText()
const toast = useToast()

const reasons = ref<CancelReason[]>([])
const reasonId = ref<number | null>(null)
const note = ref('')
const error = ref('')
const saving = ref(false)

// The list is read each time the sheet opens: a reason added in the Studio meanwhile is there.
watch(open, async (isOpen) => {
  if (!isOpen) return
  reasonId.value = null
  note.value = ''
  error.value = ''
  reasons.value = (await fetchCancelReasons({ per_page: 100, sort: 'name' })).items
})

async function save() {
  if (!reasonId.value) {
    error.value = t('visits.cancel.pick')
    return
  }
  saving.value = true
  try {
    const visit = await cancelVisit(props.visit.id, { cancel_reason_id: reasonId.value, cancel_note: note.value.trim() || null })
    toast.success(t('visits.toast.cancelled'))
    open.value = false
    emit('cancelled', visit)
  }
  catch (failure) {
    error.value = fieldErrors(failure).cancel_reason_id ?? errorMessage(failure) ?? t('studio.list.toast.failed')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlSheet v-model:open="open" :title="t('visits.cancel.title')" :description="`${visit.target.name ?? ''} · ${text.dayLong(visit.visit_date)}`">
    <div class="flex flex-col gap-4">
      <fieldset class="flex flex-col gap-1.5">
        <legend class="mb-1.5 text-[13px] font-semibold">{{ t('visits.cancel.reason') }}</legend>
        <label
          v-for="reason in reasons"
          :key="reason.id"
          class="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13.5px]"
          :class="reasonId === reason.id ? 'border-2 border-dl-fg' : 'border-dl-line'"
        >
          <input v-model="reasonId" type="radio" name="cancel-reason" :value="reason.id" class="accent-dl-fg">
          {{ reason.name }}
        </label>
        <p v-if="!reasons.length" class="text-[13px] text-dl-muted">{{ t('visits.cancel.noReasons') }}</p>
        <span v-if="error" class="text-xs text-dl-rejected">{{ error }}</span>
      </fieldset>
      <DlTextarea v-model="note" :label="t('visits.cancel.note')" :rows="2" />
      <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">{{ t('visits.cancel.hint') }}</p>
    </div>
    <template #footer>
      <DlButton variant="outline" @click="open = false">{{ t('common.actions.close') }}</DlButton>
      <DlButton variant="dark" class="flex-1" :loading="saving" @click="save">{{ t('visits.cancel.confirm') }}</DlButton>
    </template>
  </DlSheet>
</template>
