<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createEventType, deleteEventType, fetchEventTypes, updateEventType, type EventType } from '@/api/tenant/fieldSetup'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAuthStore } from '@/stores/auth'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { fieldSection } from '@/views/tenant/settings/shared/studioSections'
import {
  STUDIO_DEFAULT_SORT,
  useAddedColumn,
  useRecordPanel,
  useStudioCounts,
  useStudioList,
} from '@/views/tenant/settings/shared/useStudioList'

const { t, n } = useI18n()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()

const list = useStudioList<EventType, Record<string, never>>(
  ({ page, perPage, search, sort }) => fetchEventTypes({ page, per_page: perPage, sort, 'filter[event]': search || undefined }),
  {},
)
const { page, perPage, search, sort, items, total, loading } = list
list.reload()

const panel = useRecordPanel<EventType, { event: string }>({
  toForm: row => ({ event: row?.event ?? '' }),
  create: form => createEventType(form),
  update: (row, form) => updateEventType(row.id, form),
  remove: row => deleteEventType(row.id),
  recordName: row => row.event,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('event-types.update') : auth.can('event-types.create')))

const added = useAddedColumn()
const columns = [
  { key: 'event', label: t('fieldSetup.columns.eventType'), sortKey: 'event' },
  { key: 'events_count', label: t('fieldSetup.columns.events'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('fieldSetup.title.eventTypes')"
    :add-label="auth.can('event-types.create') ? t('fieldSetup.add.eventTypes') : undefined"
    @add="panel.show(null)"
  >
    <DlInput
      v-model="search"
      type="search"
      icon="tabler-search"
      :label="t('fieldSetup.search.eventTypes')"
      :placeholder="t('fieldSetup.search.eventTypes')"
      hide-label
      class="w-full sm:max-w-xs"
    />

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('fieldSetup.title.eventTypes')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search ? t('geo.empty.search') : t('fieldSetup.empty.eventTypes')"
      @open="panel.show"
    >
      <template #cell-event="{ row }"><strong class="font-semibold">{{ row.event }}</strong></template>
      <template #cell-events_count="{ row }">{{ row.events_count == null ? '—' : n(row.events_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.event }}</strong>
        <span class="text-xs text-dl-muted">{{ t('fieldSetup.meta.events', row.events_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel v-model:open="open" :title="record?.event ?? t('fieldSetup.add.eventTypes')">
        <form id="event-type-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.event" :label="t('geo.fields.name')" :error="errors.event" :disabled="!canEdit" required />
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.columns.events') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.events_count ?? 0) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('event-types.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="event-type-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('fieldSetup.add.eventTypes') }}
          </DlButton>
          <DlButton v-if="record && auth.can('event-types.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
