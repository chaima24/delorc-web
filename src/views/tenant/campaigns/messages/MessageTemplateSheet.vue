<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchMailTemplates, type MailChannel, type MailTemplate } from '@/api/tenant/campaignMessages'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'

// "+ Nouvel email" / "+ Nouveau SMS": start from an active template of the channel, or a blank page. The message gets
// a copy, so changing the template later never touches it. Mockup frame 2.
const props = defineProps<{ channel: MailChannel; saving: boolean }>()
const emit = defineEmits<{ choose: [templateId: number | null] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const templates = ref<MailTemplate[] | null>(null)
const search = ref('')
const picked = ref<number | null>(null)
watch(open, async value => {
  if (!value) return
  picked.value = null
  search.value = ''
  try {
    templates.value = (await fetchMailTemplates({ per_page: 100, sort: 'label', 'filter[channel]': props.channel, 'filter[is_active]': 1 })).items
  }
  catch (error) {
    templates.value = []
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}, { immediate: true })
const shown = computed(() => {
  const word = search.value.trim().toLowerCase()
  return (templates.value ?? []).filter(row => !word || [row.label, row.subject ?? '', row.brand?.name ?? ''].some(text => text.toLowerCase().includes(word)))
})
const chosen = computed(() => templates.value?.find(row => row.id === picked.value))
</script>

<template>
  <DlSheet v-model:open="open" size="lg" :title="t(`campaignMessages.new.${channel}`)" :description="t('campaignMessages.new.description')">
    <div class="flex flex-col gap-4">
      <DlInput v-model="search" :label="t('campaignMessages.new.search')" :placeholder="t('campaignMessages.new.search')" icon="tabler-search" hide-label />
      <DlSkeleton v-if="!templates" class="h-40 rounded-2xl" />
      <div v-else class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="row in shown"
          :key="row.id"
          type="button"
          class="flex flex-col gap-2 rounded-2xl border-[1.5px] p-3 text-start focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="picked === row.id ? 'border-dl-ink ring-3 ring-dl-mist' : 'border-dl-line'"
          :aria-pressed="picked === row.id"
          @click="picked = row.id"
        >
          <span class="flex h-20 flex-col gap-1.5 rounded-xl bg-dl-line-soft p-2" aria-hidden="true">
            <i class="block h-3.5 rounded bg-dl-ink" /><i class="block h-1.5 w-4/5 rounded-full bg-dl-line" /><i class="block h-1.5 rounded-full bg-dl-line" /><i class="block h-1.5 w-3/5 rounded-full bg-dl-line" />
          </span>
          <strong class="text-sm">{{ row.label }}</strong>
          <span class="text-xs text-dl-muted">{{ row.brand?.name ?? t('campaignMessages.templates.allBrands') }} · {{ t('campaignMessages.templates.files', row.attachments_count ?? 0) }}</span>
        </button>
        <button
          type="button"
          class="flex min-h-36 flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed p-3 text-dl-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="picked === 0 ? 'border-dl-ink text-dl-fg' : 'border-dl-line'"
          :aria-pressed="picked === 0"
          @click="picked = 0"
        >
          <DlIcon icon="tabler-plus" :size="22" />{{ t('campaignMessages.new.blank') }}
        </button>
      </div>
    </div>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="dark" class="ms-auto" :disabled="picked === null" :loading="saving" @click="emit('choose', picked || null)">
        {{ chosen ? t('campaignMessages.new.fromTemplate', { name: chosen.label }) : t('campaignMessages.new.write') }}
      </DlButton>
    </template>
  </DlSheet>
</template>
