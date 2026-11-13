<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import DlIcon from '@/components/DlIcon.vue'
import DlSheet from '@/components/DlSheet.vue'
import { useWorkspaces } from './useWorkspaces'

/** Phone navigation: first 4 workspaces + "More" (bottom sheet with the rest). */
const { t } = useI18n()
const { visibleWorkspaces, activeWorkspace, workspaceHome } = useWorkspaces()
const moreOpen = ref(false)

const MAX_TABS = 4
const tabs = computed(() =>
  visibleWorkspaces.value.length <= MAX_TABS + 1
    ? visibleWorkspaces.value
    : visibleWorkspaces.value.slice(0, MAX_TABS),
)
const overflow = computed(() =>
  visibleWorkspaces.value.length <= MAX_TABS + 1 ? [] : visibleWorkspaces.value.slice(MAX_TABS),
)
const overflowActive = computed(() => overflow.value.some(ws => ws.id === activeWorkspace.value?.id))

const itemClass = (active: boolean) => [
  'flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-semibold no-underline transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal',
  active ? 'bg-dl-signal text-dl-ink' : 'text-dl-on-ink-muted',
]
</script>

<template>
  <nav
    :aria-label="t('layout.mainNav')"
    class="fixed inset-x-0 bottom-0 z-1000 grid gap-1 bg-dl-ink px-2.5 text-dl-on-ink-muted pb-[max(14px,env(safe-area-inset-bottom))] pt-2 md:hidden"
    :style="{ gridTemplateColumns: `repeat(${tabs.length + (overflow.length ? 1 : 0)}, minmax(0, 1fr))` }"
  >
    <RouterLink
      v-for="ws in tabs"
      :key="ws.id"
      :to="workspaceHome(ws)!"
      :aria-current="activeWorkspace?.id === ws.id ? 'page' : undefined"
      :class="itemClass(activeWorkspace?.id === ws.id)"
    >
      <DlIcon :icon="ws.icon" :size="20" />
      {{ t(ws.title) }}
    </RouterLink>
    <button
      v-if="overflow.length"
      type="button"
      :class="itemClass(overflowActive)"
      @click="moreOpen = true"
    >
      <DlIcon icon="tabler-dots" :size="20" />
      {{ t('layout.more') }}
    </button>
  </nav>

  <DlSheet v-model:open="moreOpen" :title="t('layout.more')" side="bottom">
    <ul class="flex flex-col gap-1 pb-4">
      <li v-for="ws in overflow" :key="ws.id">
        <RouterLink
          :to="workspaceHome(ws)!"
          class="flex h-14 items-center gap-3 rounded-2xl px-4 text-[15px] font-semibold text-dl-fg no-underline hover:bg-dl-line-soft"
          @click="moreOpen = false"
        >
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-dl-ink text-dl-signal">
            <DlIcon :icon="ws.icon" :size="20" />
          </span>
          {{ t(ws.title) }}
        </RouterLink>
      </li>
    </ul>
  </DlSheet>
</template>
