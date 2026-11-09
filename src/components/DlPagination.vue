<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlIconButton from './DlIconButton.vue'
import DlSelect from './DlSelect.vue'

/**
 * "Showing 26–50 of 1 541", rows per page, and page numbers (‹ 1 2 3 … 64 ›).
 * Phones show "3 / 64" between the arrows instead of the numbers.
 */
const props = withDefaults(defineProps<{
  total: number
  sizes?: number[]
}>(), {
  sizes: () => [10, 25, 50, 100],
})

const page = defineModel<number>({ required: true })
const perPage = defineModel<number>('perPage', { required: true })
const { t, n } = useI18n()

const lastPage = computed(() => Math.max(1, Math.ceil(props.total / perPage.value)))
const from = computed(() => (props.total ? (page.value - 1) * perPage.value + 1 : 0))
const to = computed(() => Math.min(props.total, page.value * perPage.value))

/** First, last, and two pages around the current one; gaps become "…". */
const pages = computed<(number | 'gap')[]>(() => {
  const last = lastPage.value
  const current = page.value
  const wanted = new Set([1, last, current - 2, current - 1, current, current + 1, current + 2])
  const list = [...wanted].filter(p => p >= 1 && p <= last).sort((a, b) => a - b)

  return list.flatMap((p, i) => (i > 0 && p - list[i - 1]! > 1 ? ['gap' as const, p] : [p]))
})

const sizeOptions = computed(() => props.sizes.map(size => ({ value: size, label: n(size) })))
const size = computed({
  get: () => perPage.value,
  // The owner goes back to page 1 when the size changes (one reload, not two).
  set: value => { perPage.value = Number(value) },
})

function go(target: number) {
  page.value = Math.min(lastPage.value, Math.max(1, target))
}
</script>

<template>
  <nav
    v-if="total > Math.min(...sizes)"
    :aria-label="t('common.list.pagination')"
    class="flex flex-wrap items-center justify-between gap-3 pt-3"
  >
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-[13px] text-dl-muted">
        {{ t('common.list.showing', { from: n(from), to: n(to), total: n(total) }) }}
      </span>
      <DlSelect v-model="size" :label="t('common.list.rowsPerPage')" :options="sizeOptions" appearance="filter" />
    </div>

    <div v-if="lastPage > 1" class="flex items-center gap-1.5">
      <DlIconButton
        icon="tabler-chevron-left"
        :label="t('common.list.previous')"
        :size="40"
        :disabled="page <= 1"
        class="rtl:-scale-x-100"
        @click="go(page - 1)"
      />

      <ul class="hidden items-center gap-1 sm:flex">
        <li v-for="(item, index) in pages" :key="item === 'gap' ? `gap-${index}` : item">
          <span v-if="item === 'gap'" aria-hidden="true" class="px-1 text-dl-muted">…</span>
          <button
            v-else
            type="button"
            :aria-label="t('common.list.page', { page: n(item) })"
            :aria-current="item === page ? 'page' : undefined"
            class="h-10 min-w-10 rounded-xl px-2 text-sm font-semibold tabular-nums transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            :class="item === page
              ? 'bg-dl-ink text-dl-on-ink dark:bg-dl-fg dark:text-dl-mist'
              : 'text-dl-body hover:bg-dl-line-soft hover:text-dl-fg'"
            @click="go(item)"
          >
            {{ n(item) }}
          </button>
        </li>
      </ul>
      <span class="px-2 text-sm font-semibold tabular-nums sm:hidden">{{ n(page) }} / {{ n(lastPage) }}</span>

      <DlIconButton
        icon="tabler-chevron-right"
        :label="t('common.list.next')"
        :size="40"
        :disabled="page >= lastPage"
        class="rtl:-scale-x-100"
        @click="go(page + 1)"
      />
    </div>
  </nav>
</template>
