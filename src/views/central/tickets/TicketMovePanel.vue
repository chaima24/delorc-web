<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlTextarea from '@/components/DlTextarea.vue'

/** « Mark resolved » or « Close », with an optional message to the author added to the conversation. Mockup frame 7. */
defineProps<{ move: 'resolve' | 'close'; number: string; author: string; saving?: boolean }>()
const emit = defineEmits<{ confirm: [message: string | null] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const message = ref('')
watch(open, value => { if (value) message.value = '' }, { immediate: true })
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t(`central.tickets.${move}.title`, { number })" :description="t(`central.tickets.${move}.text`, { name: author })">
    <form id="ticket-move" class="flex flex-col gap-4" @submit.prevent="emit('confirm', message.trim() || null)">
      <DlTextarea v-model="message" :label="t('central.tickets.messageTo', { name: author })" :rows="5" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="ticket-move" variant="dark" class="ms-auto" :loading="saving">{{ t(`central.tickets.${move}.confirm`) }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
