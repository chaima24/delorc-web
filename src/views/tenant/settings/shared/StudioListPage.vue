<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useAuthStore } from '@/stores/auth'
import type { StudioSection } from './studioSections'
import { useStudioCounts } from './useStudioList'

/**
 * Shell of a Studio list page: breadcrumb, title, "Add", the strip of the section's pages, and a
 * row holding the list (default slot) and the record panel (`#panel`).
 * Mockup: docs/design/studio-mockups/Countries.html
 */
const props = defineProps<{
  title: string
  section: StudioSection
  /** Hidden when empty (read-only pages, or no permission to add). */
  addLabel?: string
}>()

const emit = defineEmits<{ add: [] }>()
const { t, n } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const { counts } = useStudioCounts()

const levels = computed(() => props.section.levels.filter(level => auth.can(`${level.resource}.show`) && (!level.feature || auth.hasFeature(level.feature))))
</script>

<template>
  <div class="flex w-full flex-col gap-5" :class="addLabel && 'max-md:pb-20'">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex items-center gap-1.5 text-sm text-dl-muted">
          <RouterLink :to="{ name: 'tenant-settings' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('nav.settings') }}</RouterLink>
          <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
          <span>{{ t(section.label) }}</span>
        </nav>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ title }}</h1>
      </div>
      <div v-if="addLabel" class="hidden md:block">
        <DlButton variant="primary" icon="tabler-plus" @click="emit('add')">{{ addLabel }}</DlButton>
      </div>
    </div>

    <nav :aria-label="t(section.label)" class="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul class="flex gap-1.5">
        <li v-for="level in levels" :key="level.route" class="shrink-0">
          <RouterLink
            :to="{ name: level.route }"
            :aria-current="route.name === level.route ? 'page' : undefined"
            class="flex h-[38px] items-center gap-2 rounded-xl px-3.5 text-sm font-semibold no-underline transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            :class="route.name === level.route
              ? 'bg-dl-signal-soft text-dl-fg ring-[1.5px] ring-dl-fg ring-inset'
              : 'bg-dl-paper text-dl-body hover:text-dl-fg'"
          >
            <DlIcon :icon="level.icon" :size="18" />
            {{ t(level.label) }}
            <span v-if="level.count && counts?.[level.count] != null" class="text-xs text-dl-muted tabular-nums">{{ n(counts[level.count]!) }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <div class="flex items-start gap-5">
      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <slot />
      </div>
      <slot name="panel" />
    </div>

    <!-- Phone: "Add" sits at the bottom, in reach of the thumb -->
    <div v-if="addLabel" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="emit('add')">{{ addLabel }}</DlButton>
    </div>
  </div>
</template>
