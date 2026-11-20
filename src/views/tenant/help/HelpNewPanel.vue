<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import type { Ticket } from '@/api/central/tickets'
import { createTicket, type TicketFormLists } from '@/api/tenant/tickets'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { TICKET_FILE_TYPES, TICKET_MAX_BYTES, TICKET_MAX_FILES, useTicketText } from '@/views/shared/tickets/ticketDisplay'

// « Nouveau ticket »: title, category, priority (with its hours), description, files; the page the person came from
// goes with it. One field per row. Mockup: support-mockups/ETickets.html frame 1.
const props = defineProps<{ lists: TicketFormLists | null; page: string | null }>()
const emit = defineEmits<{ created: [ticket: Ticket] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useTicketText()

const NONE = 0
const empty = () => ({ title: '', category_id: NONE, priority: '', description: '' })
const form = ref(empty())
const files = ref<File[]>([])
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = empty()
  files.value = []
  errors.value = {}
}, { immediate: true })

const categories = computed(() => [{ value: NONE, label: t('tickets.new.pickCategory') }, ...(props.lists?.categories ?? []).map(item => ({ value: item.id, label: item.name }))])
const priorities = computed(() => (props.lists?.priorities ?? []).map(item => ({ value: String(item.id), label: t('tickets.new.priority', { name: item.name, hours: item.hours }) })))

function pick(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = Array.from(input.files ?? [])
  input.value = ''
  const tooBig = chosen.filter(file => file.size > TICKET_MAX_BYTES)
  if (tooBig.length) toast.error(t('tickets.files.tooBig', { name: tooBig[0]!.name }))
  files.value = [...files.value, ...chosen.filter(file => file.size <= TICKET_MAX_BYTES)].slice(0, TICKET_MAX_FILES)
}

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const ticket = await createTicket({
      title: form.value.title,
      category_id: form.value.category_id,
      priority_id: Number(form.value.priority),
      description: form.value.description,
      page: props.page,
    }, files.value)
    toast.success(t('tickets.new.done', { number: ticket.number }))
    emit('created', ticket)
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
  <DlRecordPanel v-model:open="open" :title="t('tickets.new.title')" :description="t('tickets.new.description')">
    <form id="ticket-new" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.title" :label="t('tickets.fields.title')" :error="errors.title" />
      <DlSelect v-model="form.category_id" :label="t('tickets.fields.category')" :options="categories" />
      <p v-if="errors.category_id" class="-mt-3 text-xs text-dl-rejected">{{ errors.category_id }}</p>
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('tickets.fields.priority') }}</span>
        <DlSegmented v-if="priorities.length" v-model="form.priority" :label="t('tickets.fields.priority')" :items="priorities" block />
        <p v-if="errors.priority_id" class="text-xs text-dl-rejected">{{ errors.priority_id }}</p>
      </div>
      <DlTextarea v-model="form.description" :label="t('tickets.fields.description')" :rows="5" :error="errors.description" />
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('tickets.fields.files') }}</span>
        <ul v-if="files.length" class="flex flex-wrap gap-1.5">
          <li v-for="(file, i) in files" :key="i" class="inline-flex items-center gap-1 rounded-lg border border-dl-line py-0.5 ps-2.5 pe-1 text-[12.5px]">
            {{ file.name }} <span class="text-dl-muted">{{ text.size(file.size) }}</span>
            <DlIconButton icon="tabler-x" variant="ghost" :size="24" :label="t('tickets.files.remove', { name: file.name })" @click="files.splice(i, 1)" />
          </li>
        </ul>
        <label class="cursor-pointer rounded-xl bg-dl-mist px-3 py-2.5 text-[12.5px] text-dl-muted hover:bg-dl-line-soft" :class="files.length >= TICKET_MAX_FILES && 'pointer-events-none opacity-60'">
          + {{ t('tickets.files.add') }}
          <input type="file" multiple :accept="TICKET_FILE_TYPES" class="sr-only" @change="pick">
        </label>
        <p v-for="(message, key) in errors" v-show="String(key).startsWith('files')" :key="key" class="text-xs text-dl-rejected">{{ message }}</p>
      </div>
      <p v-if="page" class="text-xs text-dl-muted">{{ t('tickets.new.page') }} <strong class="text-dl-fg">{{ page }}</strong></p>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="ticket-new" variant="primary" class="ms-auto" :loading="saving">{{ t('tickets.new.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
