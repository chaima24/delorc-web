<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { openVisitDays } from '@/api/tenant/visitPlanning'
import type { Visit } from '@/api/tenant/visits'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { todayIso } from './visitDisplay'

// "Rouvrir un jour": a manager lets the visit's person enter the visits of past days after the entry delay,
// until the end of today. Mockup: docs/design/visits-mockups/Planning.html (frame 6)
const props = defineProps<{ visit: Visit }>()
const emit = defineEmits<{ opened: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const from = ref('')
const to = ref('')
const note = ref('')
const errors = ref<Record<string, string>>({})
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  from.value = to.value = props.visit.visit_date
  note.value = ''
  errors.value = {}
})

async function save() {
  if (!props.visit.user) return
  saving.value = true
  try {
    await openVisitDays({ user_id: props.visit.user.id, from: from.value, to: to.value, note: note.value.trim() || null })
    toast.success(t('visits.reopen.done'))
    open.value = false
    emit('opened')
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlSheet v-model:open="open" :title="t('visits.reopen.title')" :description="visit.user?.full_name">
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-3">
        <DlInput v-model="from" type="date" :max="todayIso()" :label="t('visits.filter.from')" :error="errors.from" />
        <DlInput v-model="to" type="date" :max="todayIso()" :label="t('visits.filter.to')" :error="errors.to" />
      </div>
      <DlTextarea v-model="note" :label="t('visits.reopen.note')" :rows="2" />
      <span v-if="errors.user_id" class="text-xs text-dl-rejected">{{ errors.user_id }}</span>
      <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">{{ t('visits.reopen.hint', { name: visit.user?.full_name ?? '' }) }}</p>
    </div>
    <template #footer>
      <DlButton variant="outline" @click="open = false">{{ t('common.actions.close') }}</DlButton>
      <DlButton variant="primary" class="flex-1" :loading="saving" @click="save">{{ t('visits.reopen.confirm') }}</DlButton>
    </template>
  </DlSheet>
</template>
