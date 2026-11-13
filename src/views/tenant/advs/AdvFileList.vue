<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import { useAdvText } from './advDisplay'

// Files chosen from the computer, not sent yet: a cover (one file) or the content (several for a gallery).
const props = defineProps<{
  label: string
  accept: string
  multiple?: boolean
  hint?: string
  error?: string
}>()
const files = defineModel<File[]>({ required: true })
const { t } = useI18n()
const text = useAdvText()
const input = ref<HTMLInputElement | null>(null)

function pick(event: Event) {
  const chosen = [...((event.target as HTMLInputElement).files ?? [])]
  files.value = props.multiple ? [...files.value, ...chosen] : chosen.slice(0, 1)
  if (input.value) input.value.value = '' // the same file can be chosen again
}
const remove = (index: number) => { files.value = files.value.filter((_, i) => i !== index) }
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="text-[13px] font-semibold">{{ label }}</span>
    <ul v-if="files.length" class="flex flex-col gap-1.5">
      <li v-for="(file, i) in files" :key="`${file.name}-${i}`" class="flex items-center gap-2.5 rounded-xl border border-dl-line px-3 py-2 text-[13px]">
        <DlIcon icon="tabler-file" :size="18" class="shrink-0 text-dl-muted" />
        <span class="min-w-0 flex-1">
          <span class="block truncate">{{ file.name }}</span>
          <small class="block text-xs text-dl-muted">{{ text.size(file.size) }}</small>
        </span>
        <DlIconButton icon="tabler-trash" variant="ghost" :size="32" :label="t('advs.files.remove', { name: file.name })" @click="remove(i)" />
      </li>
    </ul>
    <input ref="input" type="file" class="sr-only" tabindex="-1" :accept="accept" :multiple="multiple" :aria-label="label" @change="pick">
    <DlButton v-if="multiple || !files.length" variant="outline" icon="tabler-upload" @click="input?.click()">
      {{ t(multiple && files.length ? 'advs.files.addMore' : 'advs.files.choose') }}
    </DlButton>
    <DlButton v-else variant="ghost" size="sm" icon="tabler-replace" class="self-start" @click="input?.click()">{{ t('advs.files.change') }}</DlButton>
    <p v-if="error" role="alert" class="text-xs text-dl-rejected">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-dl-muted">{{ hint }}</p>
  </div>
</template>
