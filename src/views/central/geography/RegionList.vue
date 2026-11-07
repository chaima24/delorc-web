<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Region } from '@/api/central/geography'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { sortRows } from '@/composables/sortRows'

/** A country has few regions, all loaded: the page searches and sorts them itself. */
const props = defineProps<{ regions: Region[]; selectedId: number | null; narrow: boolean }>()
const emit = defineEmits<{ open: [region: Region] }>()

const { t, d, n } = useI18n()
const search = ref('')
const sort = ref('-created_at')

const shown = computed(() => sortRows(
  props.regions.filter((region) => region.name.toLowerCase().includes(search.value.trim().toLowerCase())),
  sort.value,
  { name: (region) => region.name, wilayas_count: (region) => region.wilayas_count, created_at: (region) => region.created_at },
))
</script>

<template>
  <div class="rounded-3xl bg-dl-paper p-4">
    <DlInput v-model="search" :label="t('central.geography.searchRegion')" :placeholder="t('central.geography.searchRegion')" hide-label icon="tabler-search" class="mb-3 w-full sm:w-60" />
    <DlEmptyState v-if="!shown.length" :title="t('central.geography.noPlace')" icon="tabler-map" />
    <table v-else class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-dl-line text-xs text-dl-muted">
          <DlSortHeader v-model="sort" column="name" :label="t('central.geography.region')" />
          <DlSortHeader v-model="sort" column="wilayas_count" :label="t('central.geography.wilayas')" />
          <DlSortHeader v-model="sort" column="created_at" :label="t('common.list.createdAt')" :class="narrow ? 'hidden' : 'hidden lg:table-cell'" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="region in shown"
          :key="region.id"
          class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft"
          :class="selectedId === region.id && 'bg-dl-signal-soft'"
          tabindex="0"
          @click="emit('open', region)"
          @keydown.enter="emit('open', region)"
        >
          <td class="p-3"><strong>{{ region.name }}</strong></td>
          <td class="p-3 tabular-nums">{{ n(region.wilayas_count) }}</td>
          <td class="p-3 text-[13px] text-dl-muted" :class="narrow ? 'hidden' : 'hidden lg:table-cell'">{{ d(new Date(region.created_at)) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
