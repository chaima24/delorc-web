<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { activityTargetKind } from '@/api/tenant/activities'
import { searchCycleProfessionals } from '@/api/tenant/cycles'
import { fetchHcps } from '@/api/tenant/hcps'
import { fetchTerritories } from '@/api/tenant/territories'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import { useUsers } from '@/views/tenant/territories/useTerritoryLookups'
import { watchDebounced } from '@/views/tenant/territories/watchDebounced'

// What the activity is linked to, by its type's "linked to": reps, pharmacies / wholesalers,
// a territory or professionals of a cycle. Search, tick; the picked ones show as chips.
const props = defineProps<{ value: string; picked?: { id: number; label: string }[]; error?: string; date?: string }>()
const model = defineModel<number[]>({ required: true })
const { t } = useI18n()
const users = useUsers()

type Row = { id: number; label: string; hint?: string }
const kind = computed(() => activityTargetKind(props.value))
const search = ref('')
const rows = ref<Row[]>([])
const loading = ref(false)
const known = ref(new Map<number, string>())
watch(() => props.picked, list => list?.forEach(row => known.value.set(row.id, row.label)), { immediate: true })

// The kinds each type may link to (the API checks them too).
const HCP_TYPES: Record<string, string> = { pharmacy: 'pharmacie', wholesaler: 'wholestore,distributor', wholesaler_pharmacy: 'pharmacie,wholestore' }

async function load() {
  loading.value = true
  try {
    const term = search.value.trim() || undefined
    if (kind.value === 'user') {
      await users.ensureLoaded()
      const words = (term ?? '').toLowerCase().split(/\s+/).filter(Boolean)
      rows.value = users.items.value
        .filter(user => user.is_active && words.every(word => user.full_name.toLowerCase().includes(word)))
        .slice(0, 50)
        .map(user => ({ id: user.id, label: user.full_name }))
    }
    else if (kind.value === 'hcp') {
      const page = await fetchHcps({ 'filter[q]': term, 'filter[type]': HCP_TYPES[props.value], per_page: 30 })
      rows.value = page.items.map(hcp => ({ id: hcp.id, label: hcp.name, hint: hcp.type ? t(`hcps.types.${hcp.type}`) : undefined }))
    }
    else if (kind.value === 'territory') {
      const page = await fetchTerritories({ 'filter[q]': term, per_page: 30 })
      rows.value = page.items.map(row => ({ id: row.id, label: row.name }))
    }
    else if (kind.value === 'cycle_target') {
      // Professionals of the cycles running on the activity's day (today when not set yet).
      const found = await searchCycleProfessionals({ q: term, date: props.date || undefined })
      rows.value = found.map(row => ({ id: row.id, label: [row.name, row.rep].filter(Boolean).join(' · '), hint: t(`hcps.types.${row.type}`) }))
    }
    rows.value.forEach(row => known.value.set(row.id, row.label))
  }
  finally {
    loading.value = false
  }
}
watch(() => props.value, () => {
  search.value = ''
  load()
}, { immediate: true })
watch(() => props.date, () => { if (kind.value === 'cycle_target') load() })
watchDebounced(search, load, 350)

function toggle(id: number) {
  model.value = model.value.includes(id) ? model.value.filter(value => value !== id) : [...model.value, id]
}
</script>

<template>
  <fieldset v-if="kind" class="flex min-w-0 flex-col gap-2">
    <legend class="mb-1 flex w-full items-baseline justify-between text-[13px] font-semibold">
      {{ t(`activities.linked.${value}`) }}
      <span class="font-normal text-dl-muted">{{ t('activities.linked.count', { count: model.length }, model.length) }}</span>
    </legend>
    <ul v-if="model.length" class="flex flex-wrap gap-1.5">
      <li v-for="id in model" :key="id">
        <button type="button" class="inline-flex items-center gap-1 rounded-full bg-dl-line-soft px-2.5 py-1 text-xs font-semibold hover:bg-dl-line" @click="toggle(id)">
          {{ known.get(id) ?? `#${id}` }}<DlIcon icon="tabler-x" :size="13" />
        </button>
      </li>
    </ul>
    <DlInput v-model="search" type="search" icon="tabler-search" :label="t('activities.linked.search')" :placeholder="t('activities.linked.search')" hide-label />
    <ul class="flex max-h-56 flex-col overflow-y-auto rounded-2xl border border-dl-line">
      <li v-for="row in rows" :key="row.id" class="border-b border-dl-line-soft last:border-b-0">
        <label class="flex min-h-11 cursor-pointer items-center gap-3 px-3.5 py-2 text-sm hover:bg-dl-mist">
          <input type="checkbox" class="h-[18px] w-[18px] shrink-0 accent-dl-ink" :checked="model.includes(row.id)" @change="toggle(row.id)">
          <span class="flex min-w-0 flex-col">
            <span class="truncate font-semibold">{{ row.label }}</span>
            <span v-if="row.hint" class="text-xs text-dl-muted">{{ row.hint }}</span>
          </span>
        </label>
      </li>
      <li v-if="loading && !rows.length" class="px-3.5 py-3 text-sm text-dl-muted">{{ t('common.modal.loading') }}</li>
      <li v-else-if="!rows.length" class="px-3.5 py-3 text-sm text-dl-muted">{{ t('activities.linked.none') }}</li>
    </ul>
    <p v-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
  </fieldset>
</template>
