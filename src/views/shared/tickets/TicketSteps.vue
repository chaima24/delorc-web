<script setup lang="ts">
import { TICKET_STATUSES, type TicketStatus } from '@/api/central/tickets'
import { useTicketText } from './ticketDisplay'

/** ouvert → en cours → résolu → fermé, the current one outlined. */
const props = defineProps<{ status: TicketStatus }>()
const text = useTicketText()
const reached = (status: TicketStatus) => TICKET_STATUSES.indexOf(status) <= TICKET_STATUSES.indexOf(props.status)
</script>

<template>
  <ol class="flex flex-wrap items-center gap-1.5 text-[13px]">
    <li v-for="(step, i) in TICKET_STATUSES" :key="step" class="flex items-center gap-1.5" :aria-current="step === status ? 'step' : undefined">
      <span
        class="rounded-full px-2.5 py-1 font-semibold"
        :class="[reached(step) ? 'bg-dl-signal-soft text-dl-fg' : 'bg-dl-line-soft text-dl-muted', step === status && 'ring-2 ring-dl-fg']"
      >{{ text.status(step) }}</span>
      <span v-if="i < TICKET_STATUSES.length - 1" aria-hidden="true" class="text-dl-muted rtl:-scale-x-100">→</span>
    </li>
  </ol>
</template>
