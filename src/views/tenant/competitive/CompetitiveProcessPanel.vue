<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlTextarea from '@/components/DlTextarea.vue'

// Marking a note « traitée », with an optional « Suite donnée » kept in the history. Mockup frame 6.
defineProps<{ number: string; saving?: boolean; error?: string }>()
const emit = defineEmits<{ confirm: [comment: string] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const comment = ref('')
watch(open, value => { if (value) comment.value = '' }, { immediate: true })
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('competitive.process.title', { number })" :description="t('competitive.process.text')">
    <form id="competitive-process" class="flex flex-col gap-4" @submit.prevent="emit('confirm', comment)">
      <DlTextarea v-model="comment" :label="t('competitive.process.comment')" :rows="4" :error="error" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('competitive.process.back') }}</DlButton>
      <DlButton type="submit" form="competitive-process" variant="dark" class="ms-auto" :loading="saving">{{ t('competitive.process.confirm') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
