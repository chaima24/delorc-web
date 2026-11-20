<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ConversationMessage } from '@/api/central/tickets'
import DlIcon from '@/components/DlIcon.vue'
import { useTicketText } from './ticketDisplay'

/**
 * A conversation, one line after the other: messages as bubbles (the viewer's side on the end), state lines centred.
 * E-tickets (`prefix` tickets, sides lab / support) and complaints (`prefix` complaints, sides author / handler).
 */
const props = withDefaults(defineProps<{ messages: ConversationMessage[]; mine: string; prefix?: 'tickets' | 'complaints' }>(), { prefix: 'tickets' })
const { t } = useI18n()
const text = useTicketText()

/** Who wrote: Delorc support in a ticket; in a complaint, « Anonyme » when the author's name is hidden. */
const nobody = () => t(props.prefix === 'tickets' ? 'tickets.support' : 'complaints.anonymous')
function author(message: ConversationMessage): string {
  if (props.prefix === 'tickets' && message.side === 'support') return t('tickets.supportBy', { name: message.by })

  return message.by ?? nobody()
}

/** « Sofia a pris le ticket en charge ». The API closing a ticket by itself has no author. */
function eventLine(message: ConversationMessage): string {
  const changes = Object.entries(message.changes ?? {}).map(([field, change]) => t(`tickets.change.${field}`, { old: change.old, new: change.new })).join(' · ')

  return t(`${props.prefix}.event.${message.event}`, { by: message.by ?? nobody(), changes })
}
</script>

<template>
  <ol class="flex flex-col gap-3">
    <li v-for="message in messages" :key="message.id" class="flex flex-col gap-2">
      <p v-if="message.event && message.event !== 'opened'" class="text-center text-xs text-dl-muted">
        {{ eventLine(message) }} · {{ text.time(message.at) }}
      </p>
      <div
        v-if="message.body || message.files.length || message.event === 'opened'"
        class="flex max-w-[78%] flex-col gap-1.5 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
        :class="message.side === mine ? 'self-end bg-dl-signal-soft' : 'self-start bg-dl-mist'"
      >
        <small class="text-[11.5px] text-dl-muted">{{ author(message) }} · {{ text.time(message.at) }}</small>
        <p v-if="message.body" class="whitespace-pre-line break-words">{{ message.body }}</p>
        <p v-else-if="message.event === 'opened'" class="text-dl-muted">{{ t('tickets.noDescription') }}</p>
        <ul v-if="message.files.length" class="flex flex-wrap gap-1.5">
          <li v-for="file in message.files" :key="file.id">
            <a
              :href="file.url"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 rounded-lg border border-dl-line bg-dl-paper px-2.5 py-1 text-[12.5px] no-underline hover:bg-dl-line-soft"
            >
              <DlIcon :icon="file.mime?.startsWith('video') ? 'tabler-movie' : file.mime === 'application/pdf' ? 'tabler-file-type-pdf' : 'tabler-photo'" :size="15" />
              {{ file.name }}<span class="text-dl-muted">{{ text.size(file.size) }}</span>
            </a>
          </li>
        </ul>
      </div>
    </li>
  </ol>
</template>
