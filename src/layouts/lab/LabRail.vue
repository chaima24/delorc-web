<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import DlIcon from '@/components/DlIcon.vue'
import DlLogo from '@/components/DlLogo.vue'
import { useWorkspaces } from './useWorkspaces'
import { useRail } from './useRail'

const { t } = useI18n()
const { visibleWorkspaces, activeWorkspace, workspaceHome } = useWorkspaces()
const { expanded, toggle } = useRail()

const mainWorkspaces = computed(() => visibleWorkspaces.value.filter(ws => ws.id !== 'studio'))
const studio = computed(() => visibleWorkspaces.value.find(ws => ws.id === 'studio'))

const itemClass = (active: boolean) => [
  'flex rounded-[14px] no-underline transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal',
  expanded.value
    ? 'h-11 w-full items-center gap-3 px-3'
    : 'h-14 w-[68px] flex-col items-center justify-center gap-[3px] px-1',
  active ? 'bg-dl-signal text-dl-ink' : 'text-dl-on-ink-muted hover:bg-dl-ink-2 hover:text-dl-on-ink',
]

const labelClass = computed(() =>
  expanded.value ? 'truncate text-sm font-semibold' : 'max-w-full truncate text-[10px] font-semibold leading-none',
)
</script>

<template>
  <nav
    :aria-label="t('layout.mainNav')"
    class="sticky top-0 hidden h-screen shrink-0 flex-col gap-5 bg-dl-ink py-[18px] transition-[width] duration-200 md:flex"
    :class="expanded ? 'w-[232px] items-stretch px-4' : 'w-[84px] items-center'"
  >
    <div class="flex items-center gap-3" :class="!expanded && 'justify-center'">
      <RouterLink :to="{ name: 'home' }" class="rounded-[14px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal">
        <DlLogo :size="44" on-dark />
      </RouterLink>
      <span v-if="expanded" class="font-display text-[22px] font-extrabold tracking-[-0.03em] text-dl-on-ink">delorc</span>
    </div>

    <ul class="flex flex-col gap-1.5" :class="expanded ? 'items-stretch' : 'items-center'">
      <li v-for="ws in mainWorkspaces" :key="ws.id">
        <RouterLink
          :to="workspaceHome(ws)!"
          :aria-current="activeWorkspace?.id === ws.id ? 'page' : undefined"
          :title="expanded ? undefined : t(ws.title)"
          :class="itemClass(activeWorkspace?.id === ws.id)"
        >
          <DlIcon :icon="ws.icon" :size="22" />
          <span :class="labelClass">{{ t(ws.title) }}</span>
        </RouterLink>
      </li>
    </ul>

    <div class="mt-auto flex flex-col gap-1.5" :class="expanded ? 'items-stretch' : 'items-center'">
      <RouterLink
        v-if="studio"
        :to="workspaceHome(studio)!"
        :aria-current="activeWorkspace?.id === 'studio' ? 'page' : undefined"
        :title="expanded ? undefined : t(studio.title)"
        :class="itemClass(activeWorkspace?.id === 'studio')"
      >
        <DlIcon :icon="studio.icon" :size="22" />
        <span :class="labelClass">{{ t(studio.title) }}</span>
      </RouterLink>

      <button
        type="button"
        :aria-expanded="expanded"
        :aria-label="expanded ? t('layout.rail.collapse') : t('layout.rail.expand')"
        :title="expanded ? t('layout.rail.collapse') : t('layout.rail.expand')"
        class="flex h-11 items-center gap-3 rounded-[14px] text-dl-on-ink-muted transition hover:bg-dl-ink-2 hover:text-dl-on-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal"
        :class="expanded ? 'w-full px-3' : 'w-11 justify-center'"
        @click="toggle"
      >
        <!-- Arrows flip in RTL so they always point toward the content edge. -->
        <DlIcon
          :icon="expanded ? 'tabler-layout-sidebar-left-collapse' : 'tabler-layout-sidebar-left-expand'"
          :size="22"
          class="rtl:-scale-x-100"
        />
        <span v-if="expanded" class="text-sm font-semibold">{{ t('layout.rail.collapse') }}</span>
      </button>
    </div>
  </nav>
</template>
