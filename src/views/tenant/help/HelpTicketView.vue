<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import type { Ticket } from '@/api/central/tickets'
import { closeTicket, fetchTicket, reopenTicket, writeTicket } from '@/api/tenant/tickets'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import TicketComposer from '@/views/shared/tickets/TicketComposer.vue'
import TicketConversation from '@/views/shared/tickets/TicketConversation.vue'
import TicketSteps from '@/views/shared/tickets/TicketSteps.vue'
import { TICKET_TONE, useTicketText } from '@/views/shared/tickets/ticketDisplay'
import { refreshUnreadTickets } from './unreadTickets'

// A ticket in the lab: the conversation with Delorc support, the box to write (author only), and when support marks it
// résolu, « Oui, fermer » / « Non, rouvrir ». The person above the author reads only. Mockup: support-mockups/ETickets.html 2–4.
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const text = useTicketText()

const ticket = ref<Ticket | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    ticket.value = await fetchTicket(Number(props.id))
    refreshUnreadTickets() // opening it reads support's messages
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { ticket.value = null; load() }, { immediate: true })
onMountedAndFocus(() => { if (ticket.value) load() })
const can = computed(() => ticket.value?.can ?? {})

const composer = ref<InstanceType<typeof TicketComposer> | null>(null)
const writing = ref(false)
const writeError = ref('')
async function write(body: string, files: File[]) {
  if (!ticket.value) return
  writing.value = true
  writeError.value = ''
  try {
    await writeTicket(ticket.value.id, body, files)
    composer.value?.clear()
    await load()
  }
  catch (error) {
    const fields = fieldErrors(error)
    writeError.value = fields.body ?? Object.values(fields)[0] ?? ''
    if (!writeError.value) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    writing.value = false
  }
}

const moving = ref(false)
async function move(action: () => Promise<Ticket>, done: string) {
  moving.value = true
  try {
    ticket.value = await action()
    toast.success(done)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    moving.value = false
  }
}
const close = () => move(() => closeTicket(ticket.value!.id), t('tickets.page.closed'))
async function reopen() {
  const ok = await confirm({ title: t('tickets.page.reopenTitle', { number: ticket.value!.number }), text: t('tickets.page.reopenText'), confirmButtonText: t('tickets.page.reopen') })
  if (ok) await move(() => reopenTicket(ticket.value!.id, null), t('tickets.page.reopened'))
}
</script>

<template>
  <DlEmptyState v-if="failed" icon="tabler-lifebuoy" :title="t('tickets.page.notFound')" />
  <DlSkeleton v-else-if="!ticket" class="h-96 rounded-3xl" />
  <div v-else class="flex w-full flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <RouterLink :to="{ name: 'tenant-help' }" class="text-sm text-dl-muted no-underline hover:underline">{{ t('tickets.help') }} › {{ t('tickets.list.title') }}</RouterLink>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ ticket.number }} · {{ ticket.title }}</h1>
        <DlBadge :tone="TICKET_TONE[ticket.status]" dot>{{ text.status(ticket.status) }}</DlBadge>
        <DlButton v-if="can.reopen && ticket.status === 'closed'" class="ms-auto" variant="outline" :loading="moving" @click="reopen">{{ t('tickets.page.reopen') }}</DlButton>
      </div>
    </div>
    <TicketSteps :status="ticket.status" />

    <template v-if="ticket.status === 'resolved' && can.close">
      <div class="flex flex-wrap items-center gap-2.5 rounded-2xl bg-dl-signal-soft px-4 py-3 text-sm">
        <span class="flex-1">{{ t('tickets.page.resolvedAsk') }}</span>
        <DlButton size="sm" variant="outline" :loading="moving" @click="reopen">{{ t('tickets.page.notFixed') }}</DlButton>
        <DlButton size="sm" variant="primary" :loading="moving" @click="close">{{ t('tickets.page.fixed') }}</DlButton>
      </div>
      <p v-if="ticket.closes_on" class="-mt-2 text-xs text-dl-muted">{{ t('tickets.page.closesOn', { date: text.date(ticket.closes_on) }) }}</p>
    </template>

    <div class="flex flex-wrap items-start gap-4">
      <section class="flex min-w-0 flex-[999_1_520px] flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('tickets.page.conversation')">
        <h2 class="text-[15px] font-semibold">{{ t('tickets.page.conversation') }}</h2>
        <TicketConversation :messages="ticket.messages ?? []" mine="lab" />
        <TicketComposer v-if="can.write" ref="composer" :saving="writing" :error="writeError" @send="write" />
        <p v-else-if="ticket.status !== 'closed'" class="rounded-xl bg-dl-mist px-3 py-2.5 text-[12.5px] text-dl-muted">{{ t('tickets.page.readOnly', { name: ticket.user.name }) }}</p>
      </section>
      <section class="flex flex-[1_1_320px] flex-col gap-3 rounded-3xl bg-dl-paper p-4 text-sm md:p-5" :aria-label="t('tickets.page.details')">
        <h2 class="text-[15px] font-semibold">{{ t('tickets.page.details') }}</h2>
        <dl class="grid grid-cols-[minmax(0,140px)_1fr] gap-x-3.5 gap-y-2">
          <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.category') }}</dt><dd>{{ ticket.category.name }}</dd>
          <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.priority') }}</dt><dd>{{ ticket.priority.name }}</dd>
          <template v-if="ticket.status === 'open' || ticket.status === 'in_progress'">
            <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.due') }}</dt>
            <dd :class="ticket.late && 'font-semibold text-dl-rejected'">{{ ticket.late ? t('tickets.late', { date: text.time(ticket.due_at) }) : text.time(ticket.due_at) }}</dd>
          </template>
          <dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.openedBy') }}</dt><dd>{{ ticket.user.name }} · {{ text.time(ticket.created_at) }}</dd>
          <template v-if="ticket.page"><dt class="text-[13px] text-dl-muted">{{ t('tickets.fields.page') }}</dt><dd>{{ ticket.page }}</dd></template>
        </dl>
      </section>
    </div>
  </div>
</template>
