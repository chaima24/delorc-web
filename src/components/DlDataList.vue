<script setup lang="ts" generic="T">
import { useI18n } from 'vue-i18n'
import DlEmptyState from './DlEmptyState.vue'
import DlIcon from './DlIcon.vue'
import DlSkeleton from './DlSkeleton.vue'

export interface DlDataListColumn {
  key: string
  label: string
  align?: 'start' | 'end'
  /** Hidden while a record panel narrows the list. */
  secondary?: boolean
  /** API sort field; makes the header clickable. */
  sortKey?: string
}

/**
 * Records as a table on desktop and as cards on phones. Clicking a row (or card) emits `open`.
 * Cells: `#cell-{key}="{ row }"`. Phone card: `#card="{ row }"` (falls back to the first column).
 */
const props = withDefaults(defineProps<{
  label: string
  columns: DlDataListColumn[]
  rows: T[]
  rowKey: (row: T) => string | number
  selectedKey?: string | number | null
  loading?: boolean
  /** A panel is open next to the list: hide secondary columns. */
  compact?: boolean
  emptyTitle?: string
  emptyText?: string
  /** The list's default order (e.g. `-id`): its column shows as sorted when `sort` is empty. */
  defaultSort?: string | null
}>(), {
  defaultSort: null,
  selectedKey: null,
  loading: false,
  compact: false,
})

const emit = defineEmits<{ open: [row: T] }>()

/**
 * Current sort as the API expects it (`name`, `-name`…). A header click cycles
 * ascending → descending → back to the default (`null`, the parent decides).
 */
const sort = defineModel<string | null>('sort', { default: null })

function sortState(col: DlDataListColumn): 'ascending' | 'descending' | 'none' {
  if (!col.sortKey) return 'none'
  const current = sort.value || props.defaultSort
  if (current === col.sortKey) return 'ascending'
  if (current === `-${col.sortKey}`) return 'descending'
  return 'none'
}

function toggleSort(col: DlDataListColumn) {
  const key = col.sortKey!
  const state = sortState(col)
  if (state === 'none') sort.value = key
  else if (state === 'ascending') sort.value = `-${key}`
  // The default column only flips between its two directions.
  else sort.value = props.defaultSort === `-${key}` ? key : null
}
const { t } = useI18n()

const visibleColumns = () => props.columns.filter(col => !(props.compact && col.secondary))
const isSelected = (row: T) => props.selectedKey != null && props.rowKey(row) === props.selectedKey
const cellValue = (row: T, key: string) => (row as Record<string, unknown>)[key] as string | number | null | undefined
</script>

<template>
  <div class="flex flex-col">
    <!-- Loading -->
    <div v-if="loading && !rows.length" class="flex flex-col gap-2 py-2" aria-busy="true">
      <DlSkeleton v-for="n in 5" :key="n" class="h-12 w-full" />
    </div>

    <!-- Empty -->
    <slot v-else-if="!rows.length" name="empty">
      <DlEmptyState icon="tabler-database-off" :title="emptyTitle ?? t('common.list.emptyTitle')" :description="emptyText" />
    </slot>

    <template v-else>
      <!-- Desktop: table -->
      <table class="hidden w-full border-collapse text-sm md:table" :aria-label="label" :aria-busy="loading || undefined">
        <thead>
          <tr>
            <th
              v-for="col in visibleColumns()"
              :key="col.key"
              scope="col"
              :aria-sort="col.sortKey ? sortState(col) : undefined"
              class="whitespace-nowrap border-b border-dl-line px-3 py-2.5 text-xs font-semibold text-dl-muted"
              :class="col.align === 'end' ? 'text-end' : 'text-start'"
            >
              <button
                v-if="col.sortKey"
                type="button"
                class="inline-flex items-center gap-1 rounded hover:text-dl-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
                :class="sortState(col) !== 'none' && 'text-dl-fg'"
                @click="toggleSort(col)"
              >
                {{ col.label }}
                <DlIcon
                  :icon="sortState(col) === 'ascending' ? 'tabler-arrow-up' : sortState(col) === 'descending' ? 'tabler-arrow-down' : 'tabler-arrows-sort'"
                  :size="14"
                  :class="sortState(col) === 'none' && 'opacity-50'"
                />
              </button>
              <template v-else>{{ col.label }}</template>
            </th>
            <th class="w-8 border-b border-dl-line" aria-hidden="true" />
          </tr>
        </thead>
        <tbody :class="loading && 'opacity-60'">
          <tr
            v-for="row in rows"
            :key="rowKey(row)"
            class="relative transition hover:bg-dl-mist"
            :class="isSelected(row) && 'bg-dl-signal-soft hover:bg-dl-signal-soft'"
          >
            <td
              v-for="(col, index) in visibleColumns()"
              :key="col.key"
              class="border-b border-dl-line-soft px-3 py-3 align-middle"
              :class="col.align === 'end' ? 'text-end tabular-nums' : 'text-start'"
            >
              <!-- The first cell's button covers the whole row, so any click opens the record. -->
              <button
                v-if="index === 0"
                type="button"
                class="text-start after:absolute after:inset-0 focus-visible:outline-hidden focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-dl-cobalt"
                :aria-current="isSelected(row) || undefined"
                @click="emit('open', row)"
              >
                <slot :name="`cell-${col.key}`" :row="row">{{ cellValue(row, col.key) ?? '—' }}</slot>
              </button>
              <slot v-else :name="`cell-${col.key}`" :row="row">{{ cellValue(row, col.key) ?? '—' }}</slot>
            </td>
            <td class="border-b border-dl-line-soft pe-2 text-end" :class="isSelected(row) ? 'text-dl-fg' : 'text-dl-muted'">
              <DlIcon icon="tabler-chevron-right" :size="18" class="rtl:-scale-x-100" />
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Phone: cards -->
      <ul class="flex flex-col gap-2.5 md:hidden" :aria-label="label">
        <li v-for="row in rows" :key="rowKey(row)">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl bg-dl-paper p-3.5 text-start focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            :class="isSelected(row) && 'ring-2 ring-dl-fg'"
            @click="emit('open', row)"
          >
            <span class="min-w-0 flex-1">
              <slot name="card" :row="row">
                <slot :name="`cell-${columns[0]!.key}`" :row="row">{{ cellValue(row, columns[0]!.key) }}</slot>
              </slot>
            </span>
            <DlIcon icon="tabler-chevron-right" :size="18" class="text-dl-muted rtl:-scale-x-100" />
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>
