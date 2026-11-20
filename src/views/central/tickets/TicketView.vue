<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { ticketsApi, type Ticket, type TicketListItem } from '@/api/central/tickets'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'
import TicketComposer from '@/views/shared/tickets/TicketComposer.vue'
import TicketConversation from '@/views/shared/tickets/TicketConversation.vue'
import TicketSteps from '@/views/shared/tickets/TicketSteps.vue'
import { TICKET_TONE, useTicketText } from '@/views/shared/tickets/ticketDisplay'
import TicketMovePanel from './TicketMovePanel.vue'

// A ticket in central: support answers (the author gets an email), takes it, marks it resolved or closes it, and may
// correct its category or priority in place. Mockup: support-mockups/ETickets.html frames 6–7.
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const toast = useToast()
const text = useTicketText()

const ticket = ref<Ticket | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    ticket.value = await ticketsApi.get(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { ticket.value = null; load() }, { immediate: true })
const can = computed(() => ticket.value?.can ?? {})

const categories = ref<TicketListItem[]>([])
const priorities = ref<TicketListItem[]>([])
onMounted(async () => {
  categories.value = await ticketsApi.items('ticket-categories').catch(() => [])
  priorities.value = await ticketsApi.items('ticket-priorities').catch(() => [])
})
// Turned-off items aren't offered, except the one the ticket already has.
const options = (items: TicketListItem[], current?: number) =>
  items.filter(item => item.is_active || item.id === current).map(item => ({ value: item.id, label: item.hours ? t('central.tickets.priorityHours', { name: item.name, hours: item.hours }) : item.name }))

// The ticket card, edited in place.
const editing = ref(false)
const draft = ref({ category_id: 0, priority_id: 0 })
watch(editing, value => { if (value && ticket.value) draft.value = { category_id: ticket.value.category.id, priority_id: ticket.value.priority.id } })
const savingCard = ref(false)
async function saveCard() {
  if (!ticket.value) return
  savingCard.value = true
  try {
    ticket.value = await ticketsApi.update(ticket.value.id, draft.value)
    editing.value = false
    toast.success(t('central.tickets.saved'))
  }
  catch (error) {
    toast.error(Object.values(fieldErrors(error))[0] ?? errorMessage(error) ?? t('errors.network'))
  }
  finally {
    savingCard.value = false
  }
}

const composer = ref<InstanceType<typeof TicketComposer> | null>(null)
const writing = ref(false)
const writeError = ref('')
async function answer(body: string, files: File[]) {
  if (!ticket.value) return
  writing.value = true
  writeError.value = ''
  try {
    await ticketsApi.answer(ticket.value.id, body, files)
    composer.value?.clear()
    await load()
  }
  catch (error) {
    const fields = fieldErrors(error)
    writeError.value = fields.body ?? Object.values(fields)[0] ?? ''
    if (!writeError.value) toast.error(errorMessage(error) ?? t('errors.network'))
  }
  finally {
    writing.value = false
  }
}

const moving = ref<'resolve' | 'close' | null>(null)
const movePanel = computed({ get: () => moving.value !== null, set: value => { if (!value) moving.value = null } })
const busy = ref(false)
async function run(action: () => Promise<Ticket>, done: string) {
  busy.value = true
  try {
    ticket.value = await action()
    moving.value = null
    toast.success(done)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('errors.network'))
  }
  finally {
    busy.value = false
  }
}
const take = () => run(() => ticketsApi.take(ticket.value!.id), t('central.tickets.taken'))
function confirmMove(message: string | null) {
  const id = ticket.value!.id
  if (moving.value === 'resolve') run(() => ticketsApi.resolve(id, message), t('central.tickets.resolve.done'))
  else run(() => ticketsApi.close(id, message), t('central.tickets.close.done'))
}
</script>

<template>
  <DlEmptyState v-if="failed" icon="tabler-lifebuoy" :title="t('central.tickets.notFound')" />
  <DlSkeleton v-else-if="!ticket" class="h-96 rounded-3xl" />
  <div v-else class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <RouterLink :to="{ name: 'central-tickets' }" class="text-sm text-dl-muted no-underline hover:underline">{{ t('central.tickets.title') }} › {{ ticket.lab?.name }}</RouterLink>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ ticket.number }} · {{ ticket.title }}</h1>
          <DlBadge :tone="TICKET_TONE[ticket.status]" dot>{{ text.status(ticket.status) }}</DlBadge>
          <span class="ms-auto flex flex-wrap gap-2">
            <DlButton v-if="can.take" variant="outline" :loading="busy" @click="take">{{ t('central.tickets.take') }}</DlButton>
            <DlButton v-if="can.close" variant="outline" @click="moving = 'close'">{{ t('central.tickets.close.button') }}</DlButton>
            <DlButton v-if="can.resolve" variant="primary" @click="moving = 'resolve'">{{ t('central.tickets.resolve.button') }}</DlButton>
          </span>
        </div>
      </div>
      <TicketSteps :status="ticket.status" />

      <div class="flex flex-wrap items-start gap-4">
        <section class="flex min-w-0 flex-[999_1_520px] flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('tickets.page.conversation')">
          <header class="flex flex-wrap items-center gap-2">
            <h2 class="flex-1 text-[15px] font-semibold">{{ t('tickets.page.conversation') }}</h2>
            <span class="text-xs text-dl-muted">{{ t('central.tickets.answerInTheirLanguage') }}</span>
          </header>
          <TicketConversation :messages="ticket.messages ?? []" mine="support" />
          <TicketComposer v-if="can.answer" ref="composer" :saving="writing" :error="writeError" :placeholder="t('central.tickets.answerHint', { name: ticket.user.name })" @send="answer" />
        </section>
        <div class="flex flex-[1_1_320px] flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
          <DlRecordSection v-model:editing="editing" :title="t('tickets.page.details')" icon="tabler-ticket" :can-edit="!!can.update" :saving="savingCard" @save="saveCard">
            <dl class="grid grid-cols-[minmax(0,120px)_1fr] gap-x-3.5 gap-y-2 text-sm">
              <dt class="text-[13px] text-dl-muted">{{ t('central.tickets.lab') }}</dt><dd>{{ ticket.lab?.name }}</dd>
              <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.author') }}</dt><dd>{{ ticket.user.name }}</dd>
              <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.category') }}</dt><dd>{{ ticket.category.name }}</dd>
              <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.priority') }}</dt><dd>{{ t('central.tickets.priorityHours', { name: ticket.priority.name, hours: ticket.priority.hours }) }}</dd>
              <template v-if="ticket.status === 'open' || ticket.status === 'in_progress'">
                <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.due') }}</dt>
                <dd :class="ticket.late && 'font-semibold text-dl-rejected'">{{ ticket.late ? t('tickets.late', { date: text.time(ticket.due_at) }) : text.time(ticket.due_at) }}</dd>
              </template>
              <template v-if="ticket.page"><dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.page') }}</dt><dd>{{ ticket.page }}</dd></template>
              <template v-if="ticket.taken_by"><dt class="text-[13px] text-dl-muted">{{ t('central.tickets.takenBy') }}</dt><dd>{{ ticket.taken_by.name }} · {{ text.time(ticket.taken_at) }}</dd></template>
              <dt class="text-[13px] text-dl-muted">{{ t('common.list.createdAt') }}</dt><dd>{{ text.time(ticket.created_at) }}</dd>
            </dl>
            <template #edit>
              <div class="flex flex-col gap-3">
                <DlSelect v-model="draft.category_id" :label="t('tickets.fields.category')" :options="options(categories, ticket.category.id)" />
                <DlSelect v-model="draft.priority_id" :label="t('tickets.fields.priority')" :options="options(priorities, ticket.priority.id)" />
                <p class="text-xs text-dl-muted">{{ t('central.tickets.priorityChange') }}</p>
              </div>
            </template>
          </DlRecordSection>
        </div>
      </div>
    </div>
    <TicketMovePanel v-if="moving" v-model:open="movePanel" :move="moving" :number="ticket.number" :author="ticket.user.name" :saving="busy" @confirm="confirmMove" />
  </div>
</template>
