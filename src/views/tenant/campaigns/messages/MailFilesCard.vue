<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MailFile } from '@/api/tenant/campaignMessages'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'

// The files sent with an email: PDF, images, Word, Excel, PowerPoint, 10 MB each (docs/api/campaign-messages.md).
defineProps<{ files: MailFile[]; canEdit: boolean; busy?: boolean; hint?: string }>()
const emit = defineEmits<{ add: [files: File[]]; remove: [id: number] }>()
const { t, n } = useI18n()

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
const picker = ref<HTMLInputElement | null>(null)
function picked(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) emit('add', files)
}
const size = (bytes: number | null) => (bytes == null ? '' : bytes >= 1_048_576 ? `${n(bytes / 1_048_576, { maximumFractionDigits: 1 })} Mo` : `${n(Math.ceil(bytes / 1024))} Ko`)
const kind = (name: string | null) => (name?.split('.').pop() ?? '').slice(0, 4).toUpperCase()
</script>

<template>
  <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
    <header class="flex items-center gap-2">
      <h2 class="text-[15px] font-semibold">{{ t('campaignMessages.files.title') }}</h2>
      <span class="text-xs text-dl-muted">{{ t('campaignMessages.files.limit') }}</span>
      <DlButton v-if="canEdit" size="sm" variant="outline" icon="tabler-paperclip" class="ms-auto" :loading="busy" @click="picker?.click()">{{ t('campaignMessages.files.add') }}</DlButton>
      <input ref="picker" type="file" multiple :accept="ACCEPT" class="hidden" @change="picked">
    </header>
    <p v-if="!files.length" class="text-[13px] text-dl-muted">{{ hint ?? t('campaignMessages.files.none') }}</p>
    <div v-for="file in files" :key="file.id" class="flex items-center gap-3 rounded-xl border border-dl-line px-3 py-2.5 text-[13.5px]">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-dl-rejected/10 text-[10px] font-extrabold text-dl-rejected">{{ kind(file.name) }}</span>
      <a v-if="file.url" :href="file.url" target="_blank" rel="noopener" class="min-w-0 flex-1 truncate font-semibold text-dl-fg no-underline hover:underline">{{ file.name }}</a>
      <span class="text-xs text-dl-muted">{{ size(file.size) }}</span>
      <DlIconButton v-if="canEdit" icon="tabler-x" :label="t('campaignMessages.files.remove', { name: file.name ?? '' })" variant="ghost" @click="emit('remove', file.id)" />
    </div>
  </section>
</template>
