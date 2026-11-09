<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import DlIcon from '@/components/DlIcon.vue'
import { useWorkspaces } from './useWorkspaces'
import { routeName } from './navigation'

/** Pages of the active workspace, as a dark tab bar above the page (Studio mockup: shown even with one tab). */
const { t } = useI18n()
const route = useRoute()
const { activeWorkspace, activeLink } = useWorkspaces()
</script>

<template>
  <div v-if="activeWorkspace" class="px-4 pt-5 md:px-7">
    <nav
      :aria-label="t(activeWorkspace.title)"
      class="rounded-[20px] bg-dl-ink p-2"
    >
      <ul class="flex gap-1.5 overflow-x-auto">
        <li v-for="link in activeWorkspace.links" :key="link.title" class="shrink-0">
          <RouterLink
            :to="link.to!"
            :aria-current="(activeLink ? activeLink === link : routeName(link) === route.name) ? 'page' : undefined"
            class="flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold no-underline transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal"
            :class="(activeLink ? activeLink === link : routeName(link) === route.name)
              ? 'bg-dl-signal text-dl-ink'
              : 'text-dl-on-ink-muted hover:bg-dl-ink-2 hover:text-dl-on-ink'"
          >
            <DlIcon v-if="link.icon" :icon="link.icon" :size="18" />
            {{ t(link.title) }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
