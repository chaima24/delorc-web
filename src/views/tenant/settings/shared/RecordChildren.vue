<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'

/** "Regions in Algeria": the record's children, each opening the child page filtered on it. */
defineProps<{
  title: string
  icon: string
  items: { id: number; name: string; meta?: string; to: RouteLocationRaw }[]
  loading?: boolean
  emptyText: string
  openLabel?: string
  openTo?: RouteLocationRaw
}>()
</script>

<template>
  <section class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-[13px] font-semibold">{{ title }}</h3>
      <RouterLink v-if="openLabel && openTo" :to="openTo" class="text-[13px] font-semibold text-dl-cobalt no-underline hover:underline">
        {{ openLabel }}
      </RouterLink>
    </div>
    <div v-if="loading" class="flex flex-col gap-2 py-2">
      <DlSkeleton v-for="i in 3" :key="i" class="h-8 w-full" />
    </div>
    <p v-else-if="!items.length" class="py-3 text-sm text-dl-muted">{{ emptyText }}</p>
    <ul v-else class="flex flex-col">
      <li v-for="item in items" :key="item.id">
        <RouterLink
          :to="item.to"
          class="flex items-center gap-2.5 border-b border-dl-line-soft py-3 text-sm text-dl-fg no-underline last:border-b-0 hover:text-dl-cobalt"
        >
          <DlIcon :icon="icon" :size="18" class="text-dl-muted" />
          <span class="min-w-0 flex-1 truncate">{{ item.name }}</span>
          <span v-if="item.meta" class="shrink-0 text-dl-muted tabular-nums">{{ item.meta }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
