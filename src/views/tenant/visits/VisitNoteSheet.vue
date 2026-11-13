<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import DlButton from '@/components/DlButton.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlTextarea from '@/components/DlTextarea.vue'

// A small sheet that asks for a required text before an action: the note of a rejected visit, the reason of a
// refused plan (docs/api/visit-approval.md). `run` does the action; the sheet closes when it succeeds.
const props = defineProps<{ title: string; description?: string; label: string; hint?: string; confirmLabel: string; run: (text: string) => Promise<unknown> }>()
const emit = defineEmits<{ done: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = ref('')
const error = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) text.value = error.value = ''
})

async function save() {
  if (!text.value.trim()) {
    error.value = t('visits.approval.textRequired')
    return
  }
  saving.value = true
  try {
    await props.run(text.value.trim())
    open.value = false
    emit('done')
  }
  catch (failure) {
    error.value = errorMessage(failure) ?? t('studio.list.toast.failed')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlSheet v-model:open="open" :title="title" :description="description">
    <div class="flex flex-col gap-3">
      <DlTextarea v-model="text" :label="label" :rows="3" />
      <span v-if="error" class="text-xs text-dl-rejected">{{ error }}</span>
      <p v-if="hint" class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">{{ hint }}</p>
    </div>
    <template #footer>
      <DlButton variant="outline" @click="open = false">{{ t('common.actions.close') }}</DlButton>
      <DlButton variant="dark" class="flex-1" :loading="saving" @click="save">{{ confirmLabel }}</DlButton>
    </template>
  </DlSheet>
</template>
