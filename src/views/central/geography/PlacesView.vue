<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { countriesApi, placesApi, type Commune, type Country, type Region, type Wilaya } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import { useAuthStore } from '@/stores/auth'
import CommuneList from './CommuneList.vue'
import CommunePanel from './CommunePanel.vue'
import RegionList from './RegionList.vue'
import RegionPanel from './RegionPanel.vue'
import WilayaList from './WilayaList.vue'
import WilayaPanel from './WilayaPanel.vue'

type Level = 'regions' | 'wilayas' | 'communes'

/** One country of the library, with its three levels as tabs. */
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const code = String(route.params.code)
const country = ref<Country | null>(null)
const regions = ref<Region[]>([])
/** Every wilaya, for the commune filter and form. */
const wilayas = ref<Wilaya[]>([])
const error = ref<string | null>(null)

const level = computed<Level>(() => (['regions', 'communes'].includes(String(route.query.level)) ? route.query.level as Level : 'wilayas'))
const regionId = computed(() => (route.query.region ? Number(route.query.region) : undefined))
const wilayaId = computed(() => (route.query.wilaya ? Number(route.query.wilaya) : undefined))

// The panel: a place, or the add form (`null` place) for the current tab.
const panel = ref<{ place: Region | Wilaya | Commune | null } | null>(null)
const panelOpen = computed({
  get: () => panel.value !== null,
  set: (open) => {
    if (!open) panel.value = null
  },
})
const selectedId = computed(() => panel.value?.place?.id ?? null)
const lists = ref<{ reload: () => Promise<void> } | null>(null)

const tabs = computed(() => [
  { level: 'regions' as const, label: t('central.geography.regions'), count: country.value?.regions_count },
  { level: 'wilayas' as const, label: t('central.geography.wilayas'), count: country.value?.wilayas_count },
  { level: 'communes' as const, label: t('central.geography.communes'), count: country.value?.communes_count },
])
const addLabel = computed(() => t({ regions: 'central.geography.addRegion', wilayas: 'central.geography.addWilaya', communes: 'central.geography.addCommune' }[level.value]))

async function loadCountry(): Promise<void> {
  error.value = null
  try {
    ;[country.value, regions.value, wilayas.value] = await Promise.all([
      countriesApi.get(code),
      placesApi.regions(code),
      placesApi.allWilayas(code),
    ])
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}

onMounted(loadCountry)

function go(target: Level, query: Record<string, number> = {}): void {
  panel.value = null
  router.replace({ query: { level: target, ...query } })
}

function onSaved(place: Region | Wilaya | Commune): void {
  panel.value = { place }
  loadCountry()
  lists.value?.reload()
}

function onDeleted(): void {
  panel.value = null
  loadCountry()
  lists.value?.reload()
}
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <RouterLink :to="{ name: 'central-countries' }" class="text-sm text-dl-muted no-underline hover:text-dl-fg">{{ t('central.geography.countries') }}</RouterLink>
          <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ country?.name ?? code }}</h1>
        </div>
        <DlButton v-if="auth.can('geography.update') && (level === 'regions' || regions.length)" variant="primary" icon="tabler-plus" @click="panel = { place: null }">{{ addLabel }}</DlButton>
      </div>
      <nav class="flex flex-wrap gap-1.5" :aria-label="country?.name">
        <button
          v-for="tab in tabs"
          :key="tab.level"
          type="button"
          class="flex h-[34px] items-center gap-1.5 rounded-[11px] bg-dl-paper px-3 text-[13px] font-semibold text-dl-body"
          :class="level === tab.level && 'bg-dl-signal-soft! text-dl-fg! shadow-[inset_0_0_0_1.5px_rgb(var(--dl-ink))]'"
          :aria-current="level === tab.level ? 'page' : undefined"
          @click="go(tab.level)"
        >
          {{ tab.label }} <small v-if="tab.count !== undefined" class="text-dl-muted">{{ n(tab.count) }}</small>
        </button>
      </nav>
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <RegionList v-if="level === 'regions'" :regions="regions" :selected-id="selectedId" :narrow="panelOpen" @open="panel = { place: $event }" />
      <WilayaList
        v-else-if="level === 'wilayas'"
        :key="`w${regionId}`"
        ref="lists"
        :code="code"
        :regions="regions"
        :region-id="regionId"
        :selected-id="selectedId"
        :narrow="panelOpen"
        @open="panel = { place: $event }"
      />
      <CommuneList
        v-else
        :key="`c${wilayaId}`"
        ref="lists"
        :code="code"
        :regions="regions"
        :wilayas="wilayas"
        :wilaya-id="wilayaId"
        :selected-id="selectedId"
        :narrow="panelOpen"
        @open="panel = { place: $event }"
      />
    </div>

    <template v-if="panel">
      <RegionPanel
        v-if="level === 'regions'"
        v-model:open="panelOpen"
        :code="code"
        :region="panel.place as Region"
        @saved="onSaved"
        @deleted="onDeleted"
        @see-wilayas="go('wilayas', { region: $event.id })"
      />
      <WilayaPanel
        v-else-if="level === 'wilayas'"
        v-model:open="panelOpen"
        :code="code"
        :wilaya="panel.place as Wilaya"
        :regions="regions"
        @saved="onSaved"
        @deleted="onDeleted"
        @see-communes="go('communes', { wilaya: $event.id })"
      />
      <CommunePanel
        v-else
        v-model:open="panelOpen"
        :code="code"
        :commune="panel.place as Commune"
        :wilayas="wilayas"
        :wilaya-id="wilayaId"
        @saved="onSaved"
        @deleted="onDeleted"
      />
    </template>
  </div>
</template>
