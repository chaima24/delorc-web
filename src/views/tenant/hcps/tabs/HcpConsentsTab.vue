<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchConsent, fetchConsents, type Consent } from '@/api/tenant/consents'
import type { Hcp } from '@/api/tenant/hcps'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlPagination from '@/components/DlPagination.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import ConsentAskPanel from '@/views/tenant/consents/ConsentAskPanel.vue'
import ConsentPanel from '@/views/tenant/consents/ConsentPanel.vue'
import { STATE_TONES, useConsentText } from '@/views/tenant/consents/consentText'

// This professional's consents, newest first; "Ask for consent" and each consent open in the side panel.
const props = defineProps<{ hcp: Hcp }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const text = useConsentText()

const rows = shallowRef<Consent[]>([])
const total = ref(0)
const page = ref(1)
const perPage = ref(10)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const result = await fetchConsents({ page: page.value, per_page: perPage.value, sort: '-id', 'filter[hcp_id]': props.hcp.id })
    rows.value = result.items
    total.value = result.total
  }
  catch {
    rows.value = []
  }
  finally {
    loading.value = false
  }
}
watch([() => props.hcp.id, page, perPage], load, { immediate: true })

const open = ref(false)
const asking = ref(false)
const selected = ref<Consent | null>(null)
async function show(id: number) {
  try {
    selected.value = await fetchConsent(id)
    asking.value = false
    open.value = true
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
function ask() {
  selected.value = null
  asking.value = true
  open.value = true
}
async function changed(id?: number) {
  await load()
  emit('changed')
  if (id) await show(id)
}
function deleted() {
  open.value = false
  selected.value = null
  changed()
}

const columns = [
  { key: 'created_at', label: t('consents.columns.asked') },
  { key: 'state', label: t('consents.columns.answer') },
  { key: 'signed_at', label: t('consents.columns.answered'), secondary: true },
]
</script>

<template>
  <div class="flex items-start gap-5">
    <section class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
      <div v-if="canStore('consents')" class="flex justify-end">
        <DlButton variant="primary" size="sm" icon="tabler-plus" @click="ask">{{ t('consents.ask.button') }}</DlButton>
      </div>
      <DlDataList
        :label="t('hcps.tabs.consents')"
        :columns="columns"
        :rows="rows"
        :row-key="row => row.id"
        :selected-key="open ? selected?.id : null"
        :loading="loading"
        :compact="open"
        :empty-title="t('hcps.consents.empty')"
        @open="row => show(row.id)"
      >
        <template #cell-created_at="{ row }"><strong class="whitespace-nowrap font-semibold">{{ text.asked(row) }}</strong></template>
        <template #cell-state="{ row }"><DlBadge size="sm" :tone="STATE_TONES[row.state]" dot>{{ text.state(row.state) }}</DlBadge></template>
        <template #cell-signed_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ row.signed_at ? text.dateTime(row.signed_at) : '—' }}</span></template>
        <template #card="{ row }">
          <span class="flex items-center gap-3">
            <span class="flex min-w-0 flex-1 flex-col"><strong class="font-semibold">{{ text.asked(row) }}</strong></span>
            <DlBadge size="sm" :tone="STATE_TONES[row.state]" dot>{{ text.state(row.state) }}</DlBadge>
          </span>
        </template>
      </DlDataList>
      <DlPagination v-if="total > perPage" v-model="page" v-model:per-page="perPage" :total="total" />
    </section>

    <ConsentAskPanel v-if="asking" v-model:open="open" :hcp="hcp" @created="consent => changed(consent.id)" />
    <ConsentPanel v-else-if="selected" v-model:open="open" :consent="selected" @changed="changed(selected?.id)" @deleted="deleted" />
  </div>
</template>
