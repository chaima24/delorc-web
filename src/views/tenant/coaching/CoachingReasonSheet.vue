<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlTextarea from '@/components/DlTextarea.vue'

// A required reason: the person coached refuses a session, or the coach cancels one.
defineProps<{ title: string; text: string; confirmLabel: string; saving?: boolean; error?: string }>()
const emit = defineEmits<{ confirm: [reason: string] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const reason = ref('')
watch(open, value => { if (value) reason.value = '' }, { immediate: true })
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="title" :description="text">
    <form id="coaching-reason" class="flex flex-col gap-4" @submit.prevent="emit('confirm', reason)">
      <DlTextarea v-model="reason" :label="t('coaching.sessions.reason')" :rows="4" :error="error" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="coaching-reason" variant="dark" class="ms-auto" :loading="saving">{{ confirmLabel }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
