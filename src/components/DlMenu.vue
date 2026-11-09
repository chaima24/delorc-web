<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import DlIcon from './DlIcon.vue'

export interface DlMenuItem {
  label: string
  icon?: string
  /** Shown in red, for destructive actions (delete). */
  danger?: boolean
  onSelect: () => void
}

/**
 * A "⋯" button opening a short list of actions. With a single action there is nothing to
 * hide: it shows as a plain button instead.
 */
defineProps<{
  label: string
  items: DlMenuItem[]
}>()
</script>

<template>
  <button
    v-if="items.length === 1"
    type="button"
    class="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-dl-line px-3 text-sm font-semibold hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
    :class="items[0]!.danger && 'text-dl-rejected'"
    @click="items[0]!.onSelect"
  >
    <DlIcon v-if="items[0]!.icon" :icon="items[0]!.icon" :size="17" />
    {{ items[0]!.label }}
  </button>
  <DropdownMenuRoot v-else-if="items.length">
    <DropdownMenuTrigger
      :aria-label="label"
      :title="label"
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-dl-line hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
    >
      <DlIcon icon="tabler-dots" :size="18" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="6"
        class="dl-pop z-2100 min-w-[220px] rounded-2xl border border-dl-line bg-dl-paper p-1.5 text-dl-fg shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]"
      >
        <DropdownMenuItem
          v-for="item in items"
          :key="item.label"
          class="flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-3 text-sm outline-hidden data-highlighted:bg-dl-line-soft"
          :class="item.danger && 'text-dl-rejected'"
          @select="item.onSelect"
        >
          <DlIcon v-if="item.icon" :icon="item.icon" :size="17" />
          {{ item.label }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
