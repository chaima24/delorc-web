<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { placesApi, type Commune, type Region, type Wilaya } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { usePlaceList, useTyped } from './usePlaceList'

const props = defineProps<{ code: string; regions: Region[]; wilayas: Wilaya[]; selectedId: number | null; narrow: boolean; wilayaId?: number }>()
const emit = defineEmits<{ open: [commune: Commune] }>()

const { t, d } = useI18n()
const search = ref('')
const typed = useTyped(search)
const region = ref<string | number>('all')
const wilaya = ref<string | number>(props.wilayaId ?? 'all')
const sort = ref('-created_at')

const list = usePlaceList<Commune>((page, perPage) => placesApi.communes(props.code, {
  search: typed.value || undefined,
  region: region.value === 'all' ? undefined : Number(region.value),
  wilaya: wilaya.value === 'all' ? undefined : Number(wilaya.value),
  sort: sort.value,
}, page, perPage), [typed, region, wilaya, sort])
const { rows, total, page, perPage, loading, error } = list

const all = computed(() => ({ value: 'all', label: t('common.list.all') }))
const regionOptions = computed(() => [all.value, ...props.regions.map(({ id, name }) => ({ value: id, label: name }))])
// The wilaya filter follows the region filter.
const wilayaOptions = computed(() => [all.value, ...props.wilayas
  .filter((item) => region.value === 'all' || item.region?.id === Number(region.value))
  .map(({ id, name }) => ({ value: id, label: name }))])

onMounted(list.reload)
defineExpose({ reload: list.reload, wilaya })
</script>

<template>
  <div class="rounded-3xl bg-dl-paper p-4">
    <DlAlert v-if="error" class="mb-3">{{ error }}</DlAlert>
    <div class="mb-3 flex flex-wrap gap-2.5">
      <DlInput v-model="search" :label="t('central.geography.searchCommune')" :placeholder="t('central.geography.searchCommune')" hide-label icon="tabler-search" class="w-full sm:w-72" />
      <DlSelect v-model="region" :label="t('central.geography.region')" :options="regionOptions" appearance="filter" />
      <DlCombobox v-model="wilaya" :label="t('central.geography.wilaya')" :options="wilayaOptions" appearance="filter" />
    </div>
    <DlEmptyState v-if="!loading && !rows.length" :title="t('central.geography.noCommune')" :description="t('central.geography.noResultHint')" icon="tabler-map" />
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-dl-line text-xs text-dl-muted">
            <DlSortHeader v-model="sort" column="name" :label="t('central.geography.commune')" />
            <DlSortHeader v-model="sort" column="wilaya" :label="t('central.geography.wilaya')" />
            <DlSortHeader v-model="sort" column="post_code" :label="t('central.geography.postCode')" />
            <DlSortHeader v-model="sort" column="created_at" :label="t('common.list.createdAt')" :class="narrow ? 'hidden' : 'hidden lg:table-cell'" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="commune in rows"
            :key="commune.id"
            class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft"
            :class="selectedId === commune.id && 'bg-dl-signal-soft'"
            tabindex="0"
            @click="emit('open', commune)"
            @keydown.enter="emit('open', commune)"
          >
            <td class="p-3"><strong class="block">{{ commune.name }}</strong><small v-if="commune.arabic_name" class="block text-xs text-dl-muted"><bdi>{{ commune.arabic_name }}</bdi></small></td>
            <td class="p-3 text-[13px]">{{ commune.wilaya?.name ?? '—' }}</td>
            <td class="p-3 text-[13px] tabular-nums text-dl-muted">{{ commune.post_code ?? '—' }}</td>
            <td class="p-3 text-[13px] text-dl-muted" :class="narrow ? 'hidden' : 'hidden lg:table-cell'">{{ d(new Date(commune.created_at)) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
  </div>
</template>
