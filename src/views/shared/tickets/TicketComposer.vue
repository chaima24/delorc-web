<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { TICKET_FILE_TYPES, TICKET_MAX_BYTES, TICKET_MAX_FILES, useTicketText } from './ticketDisplay'

/** The box under a conversation: a message, up to 5 files, « Envoyer ». The page sends it and clears the box with `clear()`. */
const props = defineProps<{ saving?: boolean; error?: string; placeholder?: string }>()
const emit = defineEmits<{ send: [body: string, files: File[]] }>()
const { t } = useI18n()
const toast = useToast()
const text = useTicketText()

const body = ref('')
const files = ref<File[]>([])
const picker = ref<HTMLInputElement | null>(null)

function pick(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = Array.from(input.files ?? [])
  input.value = ''
  const tooBig = chosen.filter(file => file.size > TICKET_MAX_BYTES)
  if (tooBig.length) toast.error(t('tickets.files.tooBig', { name: tooBig[0]!.name }))
  files.value = [...files.value, ...chosen.filter(file => file.size <= TICKET_MAX_BYTES)].slice(0, TICKET_MAX_FILES)
}
function send() {
  if (!body.value.trim() && !files.value.length) return
  emit('send', body.value.trim(), files.value)
}
defineExpose({ clear: () => { body.value = ''; files.value = [] } })
</script>

<template>
  <form class="flex flex-col gap-2 rounded-2xl border border-dl-line p-3" @submit.prevent="send">
    <DlTextarea v-model="body" :label="t('tickets.write')" hide-label :placeholder="props.placeholder ?? t('tickets.write')" :rows="3" :error="error" />
    <ul v-if="files.length" class="flex flex-wrap gap-1.5">
      <li v-for="(file, i) in files" :key="i" class="inline-flex items-center gap-1 rounded-lg border border-dl-line py-0.5 ps-2.5 pe-1 text-[12.5px]">
        {{ file.name }} <span class="text-dl-muted">{{ text.size(file.size) }}</span>
        <DlIconButton icon="tabler-x" variant="ghost" :size="24" :label="t('tickets.files.remove', { name: file.name })" @click="files.splice(i, 1)" />
      </li>
    </ul>
    <div class="flex flex-wrap items-center gap-2">
      <input ref="picker" type="file" multiple :accept="TICKET_FILE_TYPES" class="hidden" @change="pick">
      <DlButton size="sm" variant="ghost" icon="tabler-paperclip" :disabled="files.length >= TICKET_MAX_FILES" @click="picker?.click()">{{ t('tickets.files.attach') }}</DlButton>
      <span class="text-xs text-dl-muted">{{ t('tickets.files.hint') }}</span>
      <DlButton type="submit" size="sm" variant="primary" class="ms-auto" :loading="saving" :disabled="!body.trim() && !files.length">{{ t('tickets.send') }}</DlButton>
    </div>
  </form>
</template>
