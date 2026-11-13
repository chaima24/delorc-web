<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createConsent, fetchConsents, type Consent } from '@/api/tenant/consents'
import { fetchHcps, type Hcp } from '@/api/tenant/hcps'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'
import { useLabStore } from '@/stores/lab'
import { avatarName, useHcpText } from '@/views/tenant/hcps/hcpForm'
import { useConsentText } from './consentText'

// "Ask for consent": pick a professional (searched as you type); warns when a link is already waiting
// (the new one replaces it) and shows the text they will read. Mockup: docs/design/customers-mockups/Consents.html (frame 2)
const props = defineProps<{ hcp?: Hcp | null }>()
const emit = defineEmits<{ created: [consent: Consent] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const hcpText = useHcpText()
const text = useConsentText()
// The lab's name, as the public page shows it.
const labStore = useLabStore()
const lab = computed(() => labStore.lab?.name ?? '')

const search = ref('')
const results = shallowRef<Hcp[]>([])
const picked = ref<Hcp | null>(null)
const waiting = ref<Consent | null>(null)
const saving = ref(false)

watch(open, value => {
  if (!value) return
  search.value = ''
  results.value = []
  pick(props.hcp ?? null)
}, { immediate: true })

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, value => {
  clearTimeout(timer)
  if (!value.trim()) {
    results.value = []
    return
  }
  timer = setTimeout(async () => {
    try {
      results.value = (await fetchHcps({ 'filter[q]': value.trim(), per_page: 8 })).items
    }
    catch {
      results.value = []
    }
  }, 250)
})

async function pick(hcp: Hcp | null) {
  picked.value = hcp
  waiting.value = null
  if (!hcp) return
  search.value = ''
  results.value = []
  try {
    waiting.value = (await fetchConsents({ 'filter[hcp_id]': hcp.id, 'filter[state]': 'waiting', per_page: 1 })).items[0] ?? null
  }
  catch {
    // Only a warning.
  }
}

async function save() {
  if (!picked.value) return
  saving.value = true
  try {
    const consent = await createConsent({ hcp_id: picked.value.id })
    toast.success(t('consents.ask.done', { name: picked.value.name }))
    emit('created', consent)
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
const sub = (hcp: Hcp) => [hcpText.mainWorkplace(hcp).speciality ?? hcpText.type(hcp.type), hcp.commune?.name].filter(Boolean).join(' · ')
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('consents.ask.title')" :description="t('consents.ask.subtitle')">
    <div class="flex flex-col gap-4 text-[13px]">
      <div v-if="picked" class="flex items-center gap-3 rounded-2xl border border-dl-line px-3.5 py-3">
        <DlAvatar :name="avatarName(picked.name)" size="sm" tone="neutral" />
        <span class="flex min-w-0 flex-1 flex-col"><strong class="truncate">{{ picked.name }}</strong><span class="truncate text-xs text-dl-muted">{{ sub(picked) }}</span></span>
        <button v-if="!hcp" type="button" class="text-xs font-semibold text-dl-muted hover:underline" @click="pick(null)">{{ t('consents.ask.change') }}</button>
      </div>
      <div v-else class="flex flex-col gap-2">
        <DlInput v-model="search" type="search" icon="tabler-search" :label="t('consents.ask.professional')" :placeholder="t('hcps.search')" />
        <ul v-if="results.length" class="flex flex-col rounded-2xl border border-dl-line p-1">
          <li v-for="result in results" :key="result.id">
            <button type="button" class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start hover:bg-dl-mist" @click="pick(result)">
              <DlAvatar :name="avatarName(result.name)" size="sm" tone="neutral" />
              <span class="flex min-w-0 flex-col"><strong class="truncate">{{ result.name }}</strong><span class="truncate text-xs text-dl-muted">{{ sub(result) }}</span></span>
            </button>
          </li>
        </ul>
        <p v-else-if="search.trim()" class="text-xs text-dl-muted">{{ t('common.search.noMatch') }}</p>
      </div>

      <p v-if="waiting" class="flex gap-2 rounded-xl bg-dl-pending/10 px-3 py-2.5 text-dl-body">
        <DlIcon icon="tabler-info-circle" :size="17" class="mt-px shrink-0 text-dl-pending" />
        <span><strong class="text-dl-pending">{{ t('consents.ask.alreadyWaiting', { name: picked?.name ?? '' }) }}</strong> ({{ text.asked(waiting) }}). {{ t('consents.ask.replaces') }}</span>
      </p>

      <div class="flex flex-col gap-1.5">
        <span class="text-xs font-semibold text-dl-muted">{{ t('consents.ask.theyRead') }}</span>
        <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-dl-body">{{ t('consents.page.text', { lab }) }}</p>
      </div>
    </div>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="primary" class="ms-auto" :disabled="!picked" :loading="saving" @click="save">{{ t('consents.ask.create') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
