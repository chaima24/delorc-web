<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { countriesApi, type Country } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { sortRows } from '@/composables/sortRows'
import { useAuthStore } from '@/stores/auth'
import AddCountryPanel from './AddCountryPanel.vue'
import CountryPanel from './CountryPanel.vue'
import ImportCountryPanel from './ImportCountryPanel.vue'

const { t, d, n } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const countries = ref<Country[]>([])
const search = ref('')
const status = ref('all')
const sort = ref('-created_at')
const selectedCode = ref<string | null>(null)
const panel = ref<'add' | 'import' | null>(null)
const error = ref<string | null>(null)

const selected = computed(() => countries.value.find(({ code }) => code === selectedCode.value) ?? null)
const panelOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selectedCode.value = null
  },
})
const sidePanel = computed({
  get: () => panel.value !== null,
  set: (open) => {
    if (!open) panel.value = null
  },
})
const wide = computed(() => (selected.value || panel.value ? 'hidden' : 'hidden lg:table-cell'))
const statusOptions = computed(() => [
  { value: 'all', label: t('common.list.all') },
  { value: 'active', label: t('central.geography.status.active') },
  { value: 'inactive', label: t('central.geography.status.inactive') },
])

// Few countries, all loaded: the page searches and sorts them itself.
const shown = computed(() => {
  const text = search.value.trim().toLowerCase()
  const found = countries.value.filter((country) => [country.name, country.native_name ?? '', country.code].some((value) => value.toLowerCase().includes(text))
    && (status.value === 'all' || country.is_active === (status.value === 'active')))

  return sortRows(found, sort.value, {
    name: (country) => country.name,
    phone_code: (country) => country.phone_code ?? '',
    regions_count: (country) => country.regions_count,
    wilayas_count: (country) => country.wilayas_count,
    communes_count: (country) => country.communes_count,
    is_active: (country) => Number(country.is_active),
    created_at: (country) => country.created_at,
  })
})

async function load(): Promise<void> {
  error.value = null
  try {
    countries.value = await countriesApi.list()
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}

onMounted(async () => {
  await load()
  // The activity log links here with ?open={id}.
  selectedCode.value = countries.value.find(({ id }) => String(id) === route.query.open)?.code ?? null
})

function open(country: Country): void {
  panel.value = null
  selectedCode.value = country.code
}

function show(which: 'add' | 'import'): void {
  selectedCode.value = null
  panel.value = which
}

async function onAdded(country: Country): Promise<void> {
  panel.value = null
  await load()
  selectedCode.value = country.code
}

function onDeleted(): void {
  selectedCode.value = null
  load()
}
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.geography.countries') }}</h1>
        <div class="flex gap-2">
          <DlButton v-if="auth.can('geography.import')" variant="outline" @click="show('import')">{{ t('central.geography.importCountry') }}</DlButton>
          <DlButton v-if="auth.can('geography.update')" variant="primary" icon="tabler-plus" @click="show('add')">{{ t('central.geography.addCountry') }}</DlButton>
        </div>
      </div>
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
        <div class="mb-3 flex flex-wrap gap-2.5">
          <DlInput v-model="search" :label="t('central.geography.searchCountry')" :placeholder="t('central.geography.searchCountry')" hide-label icon="tabler-search" class="w-full sm:w-60" />
          <DlSelect v-model="status" :label="t('central.geography.statusLabel')" :options="statusOptions" appearance="filter" />
        </div>

        <DlEmptyState v-if="countries.length && !shown.length" :title="t('central.geography.noCountry')" icon="tabler-map" />
        <table v-else class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-dl-line text-xs text-dl-muted">
              <DlSortHeader v-model="sort" column="name" :label="t('central.geography.country')" />
              <DlSortHeader v-model="sort" column="phone_code" :label="t('central.geography.phoneCode')" :class="wide" />
              <DlSortHeader v-model="sort" column="regions_count" :label="t('central.geography.regions')" :class="wide" />
              <DlSortHeader v-model="sort" column="wilayas_count" :label="t('central.geography.wilayas')" />
              <DlSortHeader v-model="sort" column="communes_count" :label="t('central.geography.communes')" />
              <DlSortHeader v-model="sort" column="is_active" :label="t('central.geography.statusLabel')" />
              <DlSortHeader v-model="sort" column="created_at" :label="t('common.list.createdAt')" :class="wide" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="country in shown"
              :key="country.code"
              class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft"
              :class="selected?.code === country.code && 'bg-dl-signal-soft'"
              tabindex="0"
              @click="open(country)"
              @keydown.enter="open(country)"
            >
              <td class="p-3"><strong class="block">{{ country.name }}</strong><small class="block text-xs text-dl-muted">{{ country.native_name ? `${country.native_name} · ` : '' }}{{ country.code }}</small></td>
              <td class="p-3 text-[13px] text-dl-muted" :class="wide">{{ country.phone_code ?? '—' }}</td>
              <td class="p-3 tabular-nums" :class="wide">{{ n(country.regions_count) }}</td>
              <td class="p-3 tabular-nums">{{ n(country.wilayas_count) }}</td>
              <td class="p-3 tabular-nums">{{ n(country.communes_count) }}</td>
              <td class="p-3"><DlBadge :tone="country.is_active ? 'success' : 'neutral'" dot>{{ t(`central.geography.status.${country.is_active ? 'active' : 'inactive'}`) }}</DlBadge></td>
              <td class="p-3 text-[13px] text-dl-muted" :class="wide">{{ d(new Date(country.created_at)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <CountryPanel v-if="selected" v-model:open="panelOpen" :country="selected" @changed="load" @deleted="onDeleted" />
    <AddCountryPanel v-if="panel === 'add'" v-model:open="sidePanel" @added="onAdded" />
    <ImportCountryPanel v-if="panel === 'import'" v-model:open="sidePanel" @imported="load" />
  </div>
</template>
