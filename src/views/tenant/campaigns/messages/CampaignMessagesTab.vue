<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { createCampaignMessage, fetchCampaignMessages, type CampaignMessage, type MailChannel } from '@/api/tenant/campaignMessages'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import MessageTemplateSheet from './MessageTemplateSheet.vue'
import { CHANNEL_ICON, STATUS_TONE, useMessageText } from './messageDisplay'

// A campaign's "Emails & SMS" tab: channel, subject, template, state, writer, approver, files, changed on. Search,
// channel and state filters, every column sorts; a click opens the message. Mockup frame 1.
const props = defineProps<{ campaignId: number }>()
const emit = defineEmits<{ changed: [] }>()
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const text = useMessageText()
const canWrite = computed(() => auth.can('campaigns.update'))
const smsOn = computed(() => auth.hasFeature('channel.sms'))

const ALL = 'all'
const rows = ref<CampaignMessage[]>([])
const loading = ref(true)
const search = ref('')
const channel = ref(ALL)
const status = ref(ALL)
const sort = ref('-updated_at')
let timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  loading.value = true
  try {
    rows.value = await fetchCampaignMessages(props.campaignId, {
      sort: sort.value,
      'filter[search]': search.value.trim() || undefined,
      'filter[channel]': channel.value === ALL ? undefined : channel.value,
      'filter[status]': status.value === ALL ? undefined : status.value,
    })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch([channel, status, sort], load, { immediate: true })
watch(search, () => { clearTimeout(timer); timer = setTimeout(load, 300) })

const channelItems = computed(() => [ALL, 'email', 'sms'].map(value => ({ value, label: value === ALL ? t('campaignMessages.filter.all') : text.channel(value as MailChannel) })))
const statusItems = computed(() => [ALL, 'draft', 'ready', 'returned', 'approved'].map(value => ({ value, label: value === ALL ? t('campaignMessages.filter.allStates') : t(`campaignMessages.status.${value}`) })))
const filtering = computed(() => !!search.value || channel.value !== ALL || status.value !== ALL)

const columns = computed(() => [
  { key: 'channel', label: t('campaignMessages.columns.channel'), sortKey: 'channel' },
  { key: 'subject', label: t('campaignMessages.columns.subject'), sortKey: 'subject' },
  { key: 'template', label: t('campaignMessages.columns.template'), secondary: true },
  { key: 'status', label: t('campaignMessages.columns.status'), sortKey: 'status' },
  { key: 'created_by', label: t('campaignMessages.columns.writer'), sortKey: 'created_by', secondary: true },
  { key: 'approved_by', label: t('campaignMessages.columns.approver'), sortKey: 'approved_by', secondary: true },
  { key: 'attachments_count', label: t('campaignMessages.columns.files'), sortKey: 'attachments_count', align: 'end' as const, secondary: true },
  { key: 'updated_at', label: t('campaignMessages.columns.changed'), sortKey: 'updated_at', secondary: true },
])

const choosing = ref<MailChannel | null>(null)
const creating = ref(false)
const chooserOpen = computed({ get: () => choosing.value !== null, set: value => { if (!value) choosing.value = null } })
async function create(templateId: number | null) {
  if (!choosing.value) return
  creating.value = true
  try {
    const message = await createCampaignMessage({ campaign_id: props.campaignId, channel: choosing.value, mail_template_id: templateId })
    emit('changed')
    openMessage(message)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    creating.value = false
  }
}
const openMessage = (row: CampaignMessage) => router.push({ name: 'tenant-campaign-message', params: { id: props.campaignId, messageId: row.id } })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2.5">
      <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('campaignMessages.filter.search')" :placeholder="t('campaignMessages.filter.search')" icon="tabler-search" hide-label /></div>
      <DlSegmented v-if="smsOn" v-model="channel" :label="t('campaignMessages.columns.channel')" :items="channelItems" />
      <DlSegmented v-model="status" :label="t('campaignMessages.columns.status')" :items="statusItems" />
      <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="search = ''; channel = ALL; status = ALL">{{ t('common.actions.resetFilters') }}</DlButton>
      <div v-if="canWrite" class="ms-auto flex gap-2">
        <DlButton v-if="smsOn" variant="outline" icon="tabler-plus" @click="choosing = 'sms'">{{ t('campaignMessages.new.smsButton') }}</DlButton>
        <DlButton variant="primary" icon="tabler-plus" @click="choosing = 'email'">{{ t('campaignMessages.new.emailButton') }}</DlButton>
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList
        v-model:sort="sort"
        default-sort="-updated_at"
        :label="t('campaigns.tabs.messages')"
        :columns="columns"
        :rows="rows"
        :row-key="row => row.id"
        :loading="loading"
        :empty-title="filtering ? t('geo.empty.search') : t('campaignMessages.list.emptyTitle')"
        :empty-text="filtering ? undefined : t('campaignMessages.list.emptyText')"
        @open="openMessage"
      >
        <template #cell-channel="{ row }">
          <span class="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold"><DlIcon :icon="CHANNEL_ICON[row.channel]" :size="17" />{{ text.channel(row.channel) }}</span>
        </template>
        <template #cell-subject="{ row }"><strong class="font-semibold">{{ text.fields(row.subject) || t('campaignMessages.list.noSubject') }}</strong></template>
        <template #cell-template="{ row }"><span class="text-dl-muted">{{ row.template?.label ?? '—' }}</span></template>
        <template #cell-status="{ row }"><DlBadge size="sm" :tone="STATUS_TONE[row.status]" dot>{{ text.status(row.status) }}</DlBadge></template>
        <template #cell-created_by="{ row }">{{ row.created_by?.full_name ?? '—' }}</template>
        <template #cell-approved_by="{ row }"><span class="text-dl-muted">{{ row.approved_by?.full_name ?? '—' }}</span></template>
        <template #cell-attachments_count="{ row }"><span class="tabular-nums">{{ row.attachments_count ? n(row.attachments_count) : '—' }}</span></template>
        <template #cell-updated_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.date(row.updated_at) }}</span></template>
        <template #card="{ row }">
          <strong class="block font-semibold">{{ text.fields(row.subject) || t('campaignMessages.list.noSubject') }}</strong>
          <span class="text-xs text-dl-muted">{{ [text.channel(row.channel), text.status(row.status), row.created_by?.full_name].filter(Boolean).join(' · ') }}</span>
        </template>
      </DlDataList>
      <p class="text-xs text-dl-muted">{{ t('campaignMessages.list.note') }}</p>
    </div>

    <MessageTemplateSheet v-if="choosing" v-model:open="chooserOpen" :channel="choosing" :saving="creating" @choose="create" />
  </div>
</template>
