<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchMailTemplates, type MailTemplate } from '@/api/tenant/campaignMessages'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { CHANNEL_ICON, useMessageText } from '../messages/messageDisplay'
import MailTemplateAddPanel from './MailTemplateAddPanel.vue'
import { useBrandOptions } from './useBrandOptions'

// Engager › Modèles: the lab's email and SMS templates, reused by every campaign. Name, channel, brand, subject, files,
// messages made from it, on / off, added on. Mockup: docs/design/campaigns-mockups/Messages.html (frame 10)
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const text = useMessageText()
const { brands } = useBrandOptions()
const canAdd = computed(() => auth.can('mail-templates.create'))
const smsOn = computed(() => auth.hasFeature('channel.sms'))

const ALL = 'all'
const list = useStudioList<MailTemplate, { channel: string | null; brand_id: number | null; is_active: string | null }>(
  ({ page, perPage, search, sort, filters }) => fetchMailTemplates({
    page,
    per_page: perPage,
    sort,
    'filter[search]': search || undefined,
    'filter[channel]': filters.channel ?? undefined,
    'filter[brand_id]': filters.brand_id ?? undefined,
    'filter[is_active]': filters.is_active ?? undefined,
  }),
  { channel: null, brand_id: null, is_active: '1' },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const channel = computed({ get: () => filters.channel ?? ALL, set: value => { filters.channel = value === ALL ? null : value } })
const channelItems = computed(() => [ALL, 'email', 'sms'].map(value => ({ value, label: value === ALL ? t('campaignMessages.filter.all') : t(`campaignMessages.channel.${value}`) })))
const active = computed({ get: () => filters.is_active ?? ALL, set: value => { filters.is_active = value === ALL ? null : value } })
const activeItems = computed(() => [{ value: '1', label: t('campaignMessages.templates.active') }, { value: '0', label: t('campaignMessages.templates.inactive') }, { value: ALL, label: t('campaignMessages.filter.all') }])
const brand = computed({ get: () => filters.brand_id ?? ALL, set: value => { filters.brand_id = value === ALL || value == null ? null : Number(value) } })
const brandItems = computed(() => [{ value: ALL, label: t('campaignMessages.templates.allBrands') }, ...brands.value])
const filtering = computed(() => !!search.value || filters.channel != null || filters.brand_id != null || filters.is_active !== '1')
const reset = () => { search.value = ''; filters.channel = null; filters.brand_id = null; filters.is_active = '1' }

const columns = computed(() => [
  { key: 'label', label: t('campaignMessages.templates.name'), sortKey: 'label' },
  { key: 'channel', label: t('campaignMessages.columns.channel'), sortKey: 'channel' },
  { key: 'brand', label: t('campaignMessages.templates.brand'), sortKey: 'brand' },
  { key: 'subject', label: t('campaignMessages.fields.subject'), secondary: true },
  { key: 'attachments_count', label: t('campaignMessages.columns.files'), sortKey: 'attachments_count', align: 'end' as const, secondary: true },
  { key: 'messages_count', label: t('campaignMessages.templates.messages'), sortKey: 'messages_count', align: 'end' as const, secondary: true },
  { key: 'is_active', label: t('campaignMessages.templates.active') },
  { key: 'created_at', label: t('studio.list.added'), sortKey: 'id', secondary: true },
])

const adding = ref(false)
const openPage = (row: MailTemplate) => router.push({ name: 'tenant-mail-template', params: { id: row.id } })
const subject = (value: string | null) => (value ?? '—').replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (_, code: string) => `◆ ${t(`campaignMessages.fields.${code}`)}`)
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.engage') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('campaignMessages.templates.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('campaignMessages.templates.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="adding = true">{{ t('campaignMessages.templates.addButton') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('campaignMessages.templates.search')" :placeholder="t('campaignMessages.templates.search')" icon="tabler-search" hide-label /></div>
        <DlSelect v-model="brand" :label="t('campaignMessages.templates.brand')" :options="brandItems" appearance="filter" />
        <DlSegmented v-if="smsOn" v-model="channel" :label="t('campaignMessages.columns.channel')" :items="channelItems" />
        <DlSegmented v-model="active" :label="t('campaignMessages.templates.active')" :items="activeItems" />
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="reset">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-id"
          :label="t('campaignMessages.templates.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :loading="loading"
          :empty-title="filtering ? t('geo.empty.search') : t('campaignMessages.templates.emptyTitle')"
          :empty-text="filtering ? undefined : t('campaignMessages.templates.emptyText')"
          @open="openPage"
        >
          <template #cell-label="{ row }"><strong class="font-semibold">{{ row.label }}</strong></template>
          <template #cell-channel="{ row }">
            <span class="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold"><DlIcon :icon="CHANNEL_ICON[row.channel]" :size="17" />{{ text.channel(row.channel) }}</span>
          </template>
          <template #cell-brand="{ row }">{{ row.brand?.name ?? '—' }}</template>
          <template #cell-subject="{ row }"><span class="text-dl-muted">{{ row.channel === 'sms' ? '—' : subject(row.subject) }}</span></template>
          <template #cell-attachments_count="{ row }"><span class="tabular-nums">{{ row.attachments_count ? n(row.attachments_count) : '—' }}</span></template>
          <template #cell-messages_count="{ row }"><span class="tabular-nums">{{ n(row.messages_count ?? 0) }}</span></template>
          <template #cell-is_active="{ row }"><DlBadge size="sm" :tone="row.is_active ? 'success' : 'neutral'" dot>{{ row.is_active ? t('campaignMessages.templates.active') : t('campaignMessages.templates.inactive') }}</DlBadge></template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.date(row.created_at) }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.label }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.channel(row.channel), row.brand?.name, row.is_active ? null : t('campaignMessages.templates.inactive')].filter(Boolean).join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        <p class="text-xs text-dl-muted">{{ t('campaignMessages.templates.note') }}</p>
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="adding = true">{{ t('campaignMessages.templates.addButton') }}</DlButton>
      </div>
    </div>

    <MailTemplateAddPanel v-if="adding" v-model:open="adding" @created="openPage" />
  </div>
</template>
