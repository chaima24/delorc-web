<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { placesApi, type Region, type Wilaya } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { usePlaceList, useTyped } from './usePlaceList'

const props = defineProps<{ code: string; regions: Region[]; selectedId: number | null; narrow: boolean; regionId?: number }>()
const emit = defineEmits<{ open: [wilaya: Wilaya] }>()

const { t, d, n } = useI18n()
const search = ref('')
const typed = useTyped(search)
const region = ref<string | number>(props.regionId ?? 'all')
const sort = ref('-created_at')

const list = usePlaceList<Wilaya>((page, perPage) => placesApi.wilayas(props.code, {
  search: typed.value || undefined,
  region: region.value === 'all' ? undefined : Number(region.value),
  sort: sort.value,
}, page, perPage), [typed, region, sort])
const { rows, total, page, perPage, loading, error } = list

const regionOptions = computed(() => [{ value: 'all', label: t('common.list.all') }, ...props.regions.map(({ id, name }) => ({ value: id, label: name }))])
const wide = computed(() => (props.narrow ? 'hidden' : 'hidden lg:table-cell'))

onMounted(list.reload)
defineExpose({ reload: list.reload })
</script>

<template>
  <div class="rounded-3xl bg-dl-paper p-4">
    <DlAlert v-if="error" class="mb-3">{{ error }}</DlAlert>
    <div class="mb-3 flex flex-wrap gap-2.5">
      <DlInput v-model="search" :label="t('central.geography.searchWilaya')" :placeholder="t('central.geography.searchWilaya')" hide-label icon="tabler-search" class="w-full sm:w-60" />
      <DlSelect v-model="region" :label="t('central.geography.region')" :options="regionOptions" appearance="filter" />
    </div>
    <DlEmptyState v-if="!loading && !rows.length" :title="t('central.geography.noPlace')" icon="tabler-map" />
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-dl-line text-xs text-dl-muted">
            <DlSortHeader v-model="sort" column="name" :label="t('central.geography.wilaya')" />
            <DlSortHeader v-model="sort" column="region" :label="t('central.geography.region')" />
            <DlSortHeader v-model="sort" column="phone_code" :label="t('central.geography.phoneCode')" :class="wide" />
            <DlSortHeader v-model="sort" column="communes_count" :label="t('central.geography.communes')" />
            <DlSortHeader v-model="sort" column="created_at" :label="t('common.list.createdAt')" :class="wide" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="wilaya in rows"
            :key="wilaya.id"
            class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft"
            :class="selectedId === wilaya.id && 'bg-dl-signal-soft'"
            tabindex="0"
            @click="emit('open', wilaya)"
            @keydown.enter="emit('open', wilaya)"
          >
            <td class="p-3"><strong class="block">{{ wilaya.name }}</strong><small v-if="wilaya.arabic_name" class="block text-xs text-dl-muted"><bdi>{{ wilaya.arabic_name }}</bdi></small></td>
            <td class="p-3 text-[13px]">{{ wilaya.region?.name ?? '—' }}</td>
            <td class="p-3 text-[13px] text-dl-muted" :class="wide">{{ wilaya.phone_code ?? '—' }}</td>
            <td class="p-3 tabular-nums">{{ n(wilaya.communes_count) }}</td>
            <td class="p-3 text-[13px] text-dl-muted" :class="wide">{{ d(new Date(wilaya.created_at)) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
  </div>
</template>
