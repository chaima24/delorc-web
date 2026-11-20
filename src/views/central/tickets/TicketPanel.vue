<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { ticketsApi, type Ticket } from '@/api/central/tickets'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'
import { TICKET_TONE, useTicketText } from '@/views/shared/tickets/ticketDisplay'

/** A ticket beside the list: what it is about, its first message, « Take it » and « Open the ticket ». Mockup frame 5. */
const props = defineProps<{ ticket: Ticket }>()
const emit = defineEmits<{ changed: [ticket: Ticket] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useTicketText()

const full = ref<Ticket | null>(null)
watch(() => props.ticket.id, async id => {
  full.value = null
  full.value = await ticketsApi.get(id).catch(() => null)
}, { immediate: true })

const taking = ref(false)
async function take() {
  taking.value = true
  try {
    full.value = await ticketsApi.take(props.ticket.id)
    toast.success(t('central.tickets.taken'))
    emit('changed', full.value)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('errors.network'))
  }
  finally {
    taking.value = false
  }
}
const first = () => full.value?.messages?.[0]
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="ticket.number" :description="ticket.title">
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-2">
        <DlBadge size="sm" :tone="TICKET_TONE[ticket.status]" dot>{{ text.status(ticket.status) }}</DlBadge>
        <span v-if="ticket.late" class="text-xs font-semibold text-dl-rejected">{{ t('tickets.late', { date: text.time(ticket.due_at) }) }}</span>
      </span>
    </template>
    <dl class="grid grid-cols-[minmax(0,120px)_1fr] gap-x-3.5 gap-y-2 text-sm">
      <dt class="text-[13px] text-dl-muted">{{ t('central.tickets.lab') }}</dt><dd>{{ ticket.lab?.name }}</dd>
      <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.author') }}</dt><dd>{{ ticket.user.name }}</dd>
      <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.category') }}</dt><dd>{{ ticket.category.name }}</dd>
      <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.priority') }}</dt><dd>{{ t('central.tickets.priorityHours', { name: ticket.priority.name, hours: ticket.priority.hours }) }}</dd>
      <template v-if="ticket.page"><dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.page') }}</dt><dd>{{ ticket.page }}</dd></template>
      <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.messages') }}</dt><dd>{{ full?.messages?.filter(message => message.body).length ?? '…' }}</dd>
      <dt class="text-[13px] text-dl-muted">{{ t('common.list.createdAt') }}</dt><dd>{{ text.time(ticket.created_at) }}</dd>
    </dl>
    <p v-if="first()?.body" class="mt-4 whitespace-pre-line rounded-xl bg-dl-mist px-3 py-2.5 text-[13px]">{{ first()?.body }}</p>
    <p v-if="first()?.files.length" class="mt-2 text-xs text-dl-muted">{{ t('central.tickets.files', { count: first()?.files.length }, first()?.files.length ?? 0) }}</p>
    <template #footer>
      <DlButton v-if="full?.can?.take" variant="outline" :loading="taking" @click="take">{{ t('central.tickets.take') }}</DlButton>
      <DlButton variant="primary" class="ms-auto" :to="{ name: 'central-ticket', params: { id: ticket.id } }">{{ t('central.tickets.open') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
