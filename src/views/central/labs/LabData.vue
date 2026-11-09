<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { labExportsApi, labsApi, type ExportState, type Lab, type LabData, type LabExport } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { sortRows } from '@/composables/sortRows'
import { useAuthStore } from '@/stores/auth'
import { usePanelAction } from '../geography/usePanelAction'
import { useLabTexts } from './useLabTexts'

/** The Data tab: export the lab's data as one ZIP, then delete a suspended lab. */
const props = defineProps<{ lab: Lab }>()
const emit = defineEmits<{ changed: [lab: Lab] }>()

const { t, d } = useI18n()
const auth = useAuthStore()
const { fileSize } = useLabTexts()
const exportAction = usePanelAction()
const deleteAction = usePanelAction()

const data = ref<LabData | null>(null)
const error = ref<string | null>(null)
const sort = ref('-created_at')
const asking = ref(false)
const deleting = ref(false)
const slug = ref('')
const downloading = ref<number | null>(null)

const STATE_TONES: Record<ExportState, 'info' | 'success' | 'danger' | 'neutral'> = { preparing: 'info', ready: 'success', failed: 'danger', expired: 'neutral' }
const isDeleted = computed(() => props.lab.status === 'deleted')
const preparing = computed(() => data.value?.exports.some((line) => line.state === 'preparing') ?? false)
const canDelete = computed(() => auth.can('labs.delete') && !isDeleted.value)
const when = (value: string | null) => (value ? d(new Date(value), { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const exports = computed(() => sortRows(data.value?.exports ?? [], sort.value, {
  created_at: (line) => line.created_at,
  requested_by: (line) => line.requested_by?.name ?? '',
  state: (line) => t(`central.labs.data.state.${line.state}`),
  size_bytes: (line) => line.size_bytes ?? -1,
  expires_at: (line) => line.expires_at ?? '',
}))

async function load(): Promise<void> {
  try {
    data.value = await labExportsApi.get(props.lab.id)
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}

// While an export is being prepared, the page asks again every 5 seconds, and stops once nothing is preparing.
let timer: ReturnType<typeof setInterval> | undefined
watch(preparing, (now) => {
  clearInterval(timer)
  if (now) timer = setInterval(load, 5000)
})
onMounted(load)
onUnmounted(() => clearInterval(timer))

const askExport = () => exportAction.run(() => labExportsApi.ask(props.lab.id), async () => {
  asking.value = false
  await load()
})

async function download(line: LabExport): Promise<void> {
  downloading.value = line.id
  error.value = null
  try {
    window.location.assign(await labExportsApi.downloadUrl(line.id))
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
    await load() // it may have just expired
  } finally {
    downloading.value = null
  }
}

function openDelete(): void {
  slug.value = ''
  deleteAction.clear()
  deleting.value = true
}

const confirmDelete = () => deleteAction.run(() => labsApi.remove(props.lab.id, slug.value), async (deleted) => {
  deleting.value = false
  emit('changed', deleted)
  await load()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <DlAlert v-if="error">{{ error }}</DlAlert>

    <div v-if="data" class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
      <div class="mb-1.5 flex items-center gap-2.5">
        <h2 class="flex-1 text-[15px] font-bold">{{ t('central.labs.data.exports') }}</h2>
        <DlButton v-if="!isDeleted" variant="primary" size="sm" icon="tabler-download" :disabled="preparing" @click="exportAction.clear(); asking = true">
          {{ preparing ? t('central.labs.data.preparing') : t('central.labs.data.export') }}
        </DlButton>
      </div>
      <p class="mb-2 text-xs text-dl-muted">{{ t('central.labs.data.exportsHint') }}</p>

      <DlEmptyState v-if="!data.exports.length" :title="t('central.labs.data.none')" icon="tabler-file-zip" />
      <table v-else class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-dl-line text-xs text-dl-muted">
            <DlSortHeader v-model="sort" column="created_at" :label="t('central.labs.data.askedOn')" />
            <DlSortHeader v-model="sort" column="requested_by" :label="t('central.labs.data.askedBy')" class="hidden md:table-cell" />
            <DlSortHeader v-model="sort" column="state" :label="t('central.labs.data.stateLabel')" />
            <DlSortHeader v-model="sort" column="size_bytes" :label="t('central.labs.data.size')" class="hidden md:table-cell" />
            <DlSortHeader v-model="sort" column="expires_at" :label="t('central.labs.data.until')" />
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in exports" :key="line.id" class="border-b border-dl-line-soft">
            <td class="p-3 tabular-nums">{{ when(line.created_at) }}</td>
            <td class="hidden p-3 md:table-cell">{{ line.requested_by?.name ?? '—' }}</td>
            <td class="p-3">
              <DlBadge :tone="STATE_TONES[line.state]" dot size="sm">{{ t(`central.labs.data.state.${line.state}`) }}</DlBadge>
              <span v-if="line.error" class="ms-1.5 text-xs text-dl-muted">{{ line.error }}</span>
            </td>
            <td class="hidden p-3 tabular-nums md:table-cell">{{ fileSize(line.size_bytes) }}</td>
            <td class="p-3 tabular-nums">{{ when(line.expires_at) }}</td>
            <td class="p-3 text-end">
              <DlButton v-if="line.state === 'ready'" variant="outline" size="sm" icon="tabler-download" :loading="downloading === line.id" @click="download(line)">{{ t('central.labs.data.download') }}</DlButton>
              <DlButton v-else-if="line.state === 'failed' && !isDeleted && !preparing" variant="outline" size="sm" @click="exportAction.clear(); asking = true">{{ t('central.labs.data.tryAgain') }}</DlButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Owner only (labs.delete). -->
    <div v-if="data && canDelete" class="flex flex-col gap-2.5 rounded-3xl border-[1.5px] border-dl-rejected/35 bg-dl-paper p-4">
      <div class="flex items-center gap-2.5">
        <h2 class="flex-1 text-[15px] font-bold text-dl-rejected">{{ t('central.labs.data.deleteTitle') }}</h2>
        <DlButton variant="danger" size="sm" :disabled="!data.delete.allowed" @click="openDelete">{{ t('central.labs.data.deleteOpen') }}</DlButton>
      </div>
      <p class="text-xs text-dl-muted">{{ t('central.labs.data.deleteHint') }}</p>
      <p v-if="data.delete.allowed" class="rounded-xl bg-dl-signal-soft px-3 py-2.5 text-[13px] text-dl-fg">{{ t('central.labs.data.deleteReady') }}</p>
      <p v-else-if="data.delete.reason === 'not_suspended'" class="text-xs text-dl-muted">{{ t('central.labs.data.reason.not_suspended') }}</p>
      <p v-else class="rounded-xl bg-dl-pending/10 px-3 py-2.5 text-[13px] text-dl-pending">{{ t(`central.labs.data.reason.${data.delete.reason}`) }}</p>
    </div>

    <DlSheet v-model:open="asking" :title="t('central.labs.data.exportTitle', { name: lab.name })">
      <div class="flex flex-col gap-3.5 text-sm text-dl-body">
        <DlAlert v-if="exportAction.error.value">{{ exportAction.error.value }}</DlAlert>
        <p>{{ t('central.labs.data.exportHolds') }}</p>
        <ul class="flex list-disc flex-col gap-1 ps-5">
          <li>{{ t('central.labs.data.holdsTables') }}</li>
          <li>{{ t('central.labs.data.holdsFiles') }}</li>
          <li>{{ t('central.labs.data.holdsLab') }}</li>
        </ul>
        <p class="text-xs text-dl-muted">{{ t('central.labs.data.noSecrets') }}</p>
        <p>{{ t('central.labs.data.emailTo', { email: auth.user?.email ?? '' }) }}</p>
      </div>
      <template #footer>
        <DlButton variant="outline" size="sm" @click="asking = false">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton variant="primary" size="sm" :loading="exportAction.busy.value" @click="askExport">{{ t('central.labs.data.export') }}</DlButton>
      </template>
    </DlSheet>

    <DlSheet v-model:open="deleting" :title="t('central.labs.data.deleteConfirmTitle', { name: lab.name })">
      <div class="flex flex-col gap-3.5 text-sm text-dl-body">
        <DlAlert v-if="deleteAction.error.value">{{ deleteAction.error.value }}</DlAlert>
        <p>{{ t('central.labs.data.deleteWarning') }} <strong>{{ t('central.labs.data.cannotUndo') }}</strong></p>
        <DlInput
          v-model="slug"
          :label="t('central.labs.data.typeSlug', { slug: lab.id })"
          :placeholder="lab.id"
          :hint="t('central.labs.data.typeSlugHint')"
          :error="deleteAction.errors.value.slug"
          autocomplete="off"
        />
      </div>
      <template #footer>
        <DlButton variant="outline" size="sm" @click="deleting = false">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton variant="danger" size="sm" :disabled="slug !== lab.id" :loading="deleteAction.busy.value" @click="confirmDelete">{{ t('central.labs.data.deleteConfirm') }}</DlButton>
      </template>
    </DlSheet>
  </div>
</template>
