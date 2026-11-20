<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { sendComplaint, type Complaint, type ComplaintForm } from '@/api/tenant/complaints'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { TICKET_MAX_FILES, useTicketText } from '@/views/shared/tickets/ticketDisplay'
import { COMPLAINT_FILE_TYPES, COMPLAINT_MAX_BYTES } from './complaintDisplay'

// « Nouvelle réclamation »: title, category, urgency, message, person concerned, files, and « Envoyer sans mon nom »
// when the lab allows it. One field per row. Mockup: complaints-mockups/Complaints.html frame 1.
const props = defineProps<{ form: ComplaintForm | null }>()
const emit = defineEmits<{ sent: [complaint: Complaint] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useTicketText()

const NONE = 0
const empty = () => ({ title: '', category_id: NONE, urgency: 'normal', body: '', concerned_user_id: NONE, anonymous: false })
const draft = ref(empty())
const files = ref<File[]>([])
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  draft.value = empty()
  files.value = []
  errors.value = {}
}, { immediate: true })

const categories = computed(() => [{ value: NONE, label: t('complaints.new.pickCategory') }, ...(props.form?.categories ?? []).map(item => ({ value: item.id, label: item.name }))])
const people = computed(() => [{ value: NONE, label: t('complaints.new.nobody') }, ...(props.form?.people ?? []).map(item => ({ value: item.id, label: item.name }))])
const urgencies = computed(() => ['normal', 'urgent'].map(value => ({ value, label: t(`complaints.urgency.${value}`) })))

function pick(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = Array.from(input.files ?? [])
  input.value = ''
  const tooBig = chosen.filter(file => file.size > COMPLAINT_MAX_BYTES)
  if (tooBig.length) toast.error(t('complaints.files.tooBig', { name: tooBig[0]!.name }))
  files.value = [...files.value, ...chosen.filter(file => file.size <= COMPLAINT_MAX_BYTES)].slice(0, TICKET_MAX_FILES)
}

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const complaint = await sendComplaint({
      ...draft.value,
      urgency: draft.value.urgency as 'normal' | 'urgent',
      concerned_user_id: draft.value.concerned_user_id || null,
      anonymous: !!props.form?.anonymous_allowed && draft.value.anonymous,
    }, files.value)
    toast.success(t('complaints.new.done', { number: complaint.number }))
    emit('sent', complaint)
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
  <DlRecordPanel v-model:open="open" :title="t('complaints.new.title')" :description="t('complaints.new.description')">
    <form id="complaint-new" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="draft.title" :label="t('complaints.fields.title')" :error="errors.title" />
      <div class="flex flex-col gap-1">
        <DlSelect v-model="draft.category_id" :label="t('complaints.fields.category')" :options="categories" />
        <p v-if="errors.category_id" class="text-xs text-dl-rejected">{{ errors.category_id }}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('complaints.fields.urgency') }}</span>
        <DlSegmented v-model="draft.urgency" :label="t('complaints.fields.urgency')" :items="urgencies" block />
      </div>
      <DlTextarea v-model="draft.body" :label="t('complaints.fields.body')" :rows="5" :error="errors.body" />
      <div class="flex flex-col gap-1">
        <DlSelect v-model="draft.concerned_user_id" :label="t('complaints.fields.concerned')" :options="people" />
        <p class="text-xs text-dl-muted">{{ errors.concerned_user_id ?? t('complaints.new.concernedHint') }}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('complaints.fields.files') }}</span>
        <ul v-if="files.length" class="flex flex-wrap gap-1.5">
          <li v-for="(file, i) in files" :key="i" class="inline-flex items-center gap-1 rounded-lg border border-dl-line py-0.5 ps-2.5 pe-1 text-[12.5px]">
            {{ file.name }} <span class="text-dl-muted">{{ text.size(file.size) }}</span>
            <DlIconButton icon="tabler-x" variant="ghost" :size="24" :label="t('tickets.files.remove', { name: file.name })" @click="files.splice(i, 1)" />
          </li>
        </ul>
        <label class="cursor-pointer rounded-xl bg-dl-mist px-3 py-2.5 text-[12.5px] text-dl-muted hover:bg-dl-line-soft" :class="files.length >= TICKET_MAX_FILES && 'pointer-events-none opacity-60'">
          + {{ t('complaints.files.add') }}
          <input type="file" multiple :accept="COMPLAINT_FILE_TYPES" class="sr-only" @change="pick">
        </label>
        <p v-for="(message, key) in errors" v-show="String(key).startsWith('files')" :key="key" class="text-xs text-dl-rejected">{{ message }}</p>
      </div>
      <div v-if="form?.anonymous_allowed" class="flex flex-col gap-1 rounded-xl bg-dl-mist px-3 py-2.5">
        <DlSwitch v-model="draft.anonymous" :label="t('complaints.new.anonymous')" />
        <p class="text-xs text-dl-muted">{{ t('complaints.new.anonymousHint') }}</p>
      </div>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="complaint-new" variant="primary" class="ms-auto" :loading="saving">{{ t('complaints.new.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
