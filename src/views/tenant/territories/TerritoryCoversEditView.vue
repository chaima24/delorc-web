<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchTerritory, updateTerritory, type Territory } from '@/api/tenant/territories'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'
import CoverageCount from './CoverageCount.vue'
import CoversEditor from './CoversEditor.vue'
import { picksFromCovers, toCoversPayload, zonesFrom, type CoverPick, type Zones } from './coversForm'
import { useCoverage } from './useCoverage'
import { useTerritoryTypes } from './useTerritoryTypes'

// What a territory covers, edited on its own page (✎ Edit on Covers, from the panel or the full
// page), with the count before and after saving. Mockup: docs/design/customers-mockups/Territories.html (frame 5b)
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const router = useRouter()
const toast = useToast()
const types = useTerritoryTypes()

const territory = ref<Territory | null>(null)
const failed = ref(false)
const picks = ref<CoverPick[]>([])
const zones = ref<Zones>({})
const error = ref('')
const saving = ref(false)
const { coverage, counting } = useCoverage(picks)

fetchTerritory(Number(props.id))
  .then(found => {
    territory.value = found
    picks.value = picksFromCovers(territory.value.covers, territory.value.zones)
    zones.value = zonesFrom(territory.value.zones)
  })
  .catch(() => (failed.value = true))

// Back where Edit was clicked (the list's panel or the full page).
function leave() {
  if (window.history.state?.back) router.back()
  else router.push({ name: 'tenant-territory-detail', params: { id: props.id } })
}

async function save() {
  error.value = picks.value.length ? '' : t('territories.covers.required')
  if (error.value || !territory.value) return
  saving.value = true
  try {
    await updateTerritory(territory.value.id, toCoversPayload(types.all.value, picks.value, zones.value))
    toast.success(t('studio.list.toast.saved'))
    leave()
  }
  catch (failure) {
    if (Object.keys(fieldErrors(failure)).length) error.value = errorMessage(failure) ?? ''
    else toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <RouterLink :to="{ name: 'tenant-territories' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('territories.title') }}</RouterLink>
      <template v-if="territory">
        <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
        <RouterLink :to="{ name: 'tenant-territory-detail', params: { id: territory.id } }" class="text-dl-muted no-underline hover:text-dl-fg">{{ territory.name }}</RouterLink>
      </template>
    </nav>

    <p v-if="failed" class="rounded-3xl bg-dl-paper p-5 text-sm text-dl-rejected">{{ t('territories.page.notFound') }}</p>
    <div v-else-if="!territory" class="flex flex-col gap-3" aria-hidden="true">
      <DlSkeleton class="h-12 w-80 rounded-2xl" />
      <DlSkeleton class="h-80 rounded-3xl" />
    </div>

    <template v-else>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[36px]">{{ t('territories.covers.editTitle', { name: territory.name }) }}</h1>

      <form id="territory-covers" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]" @submit.prevent="save">
        <div class="min-w-0 rounded-3xl bg-dl-paper p-4 md:p-5">
          <CoversEditor v-model:picks="picks" v-model:zones="zones" :types="types.pickable.value" :error="error" />
        </div>
        <aside class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('territories.covers.after')">
          <h2 class="text-[15px] font-semibold">{{ t('territories.covers.after') }}</h2>
          <p class="text-[13px] text-dl-muted">{{ t('territories.covers.before', { n: n(territory.hcps_count ?? 0) }, territory.hcps_count ?? 0) }}</p>
          <CoverageCount :coverage="coverage" :counting="counting" />
        </aside>
      </form>

      <div class="flex items-center gap-2.5 rounded-3xl bg-dl-paper p-3 md:px-4">
        <DlButton variant="ghost" @click="leave">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton type="submit" form="territory-covers" variant="primary" class="ms-auto" :loading="saving">{{ t('common.actions.save') }}</DlButton>
      </div>
    </template>
  </div>
</template>
