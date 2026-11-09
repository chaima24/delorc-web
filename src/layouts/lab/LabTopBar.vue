<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import DlIcon from '@/components/DlIcon.vue'
import { THEMES, useTheme, type ThemeChoice } from '@/composables/useTheme'
import { currentLocale, setLocale } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import { useLabStore } from '@/stores/lab'
import LabSearch from './LabSearch.vue'
import { useRail } from './useRail'

/**
 * The central console's top bar, plus the lab's logo and name on the left.
 * Left: lab, search. Right: notifications, language, theme, my account.
 */
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const labStore = useLabStore()
const { theme } = useTheme()
const rail = useRail()

const searching = ref(false)
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

const THEME_ICONS: Record<ThemeChoice, string> = { light: 'tabler-sun', dark: 'tabler-moon', system: 'tabler-device-desktop' }

/** The lab's own languages, each in its own words. */
const languages = computed(() => labStore.lab?.languages ?? [])
const locale = computed({
  get: () => currentLocale(),
  /** Loads that language's texts. Kept in this browser; saved on the person with the lab profile (later). */
  set: (value: string) => void setLocale(value),
})
const languageName = computed(() => languages.value.find((language) => language.code === locale.value)?.native_name ?? locale.value)

async function signOut(): Promise<void> {
  await auth.logout()
  router.push({ name: 'login' })
}

const trigger = 'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-dl-line bg-dl-paper text-dl-fg hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt'
const menu = 'z-2100 min-w-[220px] rounded-2xl border border-dl-line bg-dl-paper p-1.5 text-dl-fg shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]'
const item = 'flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-3 text-sm outline-hidden data-highlighted:bg-dl-line-soft'
</script>

<template>
  <header class="sticky top-0 z-900 flex items-center gap-2.5 border-b border-dl-line bg-dl-paper px-4 py-3 md:px-7">
    <!-- Opens / closes the rail (tablet and desktop; phones use the bottom bar). -->
    <button
      type="button"
      :class="[trigger, 'hidden w-11 md:inline-flex']"
      :aria-expanded="rail.expanded.value"
      :aria-label="rail.expanded.value ? t('layout.rail.collapse') : t('layout.rail.expand')"
      :title="rail.expanded.value ? t('layout.rail.collapse') : t('layout.rail.expand')"
      @click="rail.toggle"
    >
      <DlIcon :icon="rail.expanded.value ? 'tabler-layout-sidebar-left-collapse' : 'tabler-layout-sidebar-left-expand'" :size="20" class="rtl:-scale-x-100" />
    </button>

    <span class="flex shrink-0 items-center gap-2.5 pe-1 text-[15px] font-bold">
      <img v-if="labStore.lab?.logo_url" :src="labStore.lab.logo_url" alt="" class="h-9 w-9 rounded-[10px] border border-dl-line bg-white object-contain">
      <span v-else class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-dl-ink font-display text-base font-extrabold text-dl-signal">
        {{ labStore.lab?.name.charAt(0).toUpperCase() }}
      </span>
      <span class="hidden sm:inline">{{ labStore.lab?.name }}</span>
    </span>

    <button
      type="button"
      class="flex h-11 min-w-0 max-w-[420px] flex-1 items-center gap-2.5 rounded-[14px] border border-dl-line bg-dl-mist px-3.5 text-start text-sm text-dl-muted hover:border-dl-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
      @click="searching = true"
    >
      <DlIcon icon="tabler-search" :size="18" />
      <span class="truncate">{{ t('layout.topbar.search') }}</span>
      <kbd class="ms-auto hidden rounded-md border border-dl-line px-1.5 py-0.5 font-sans text-xs sm:inline">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
    </button>

    <div class="ms-auto flex items-center gap-2.5">
      <!-- Notifications: the design only for now; the items come with the first module that has events. -->
      <PopoverRoot>
        <PopoverTrigger as-child>
          <button type="button" :aria-label="t('layout.topbar.notifications')" :class="[trigger, 'w-11']">
            <DlIcon icon="tabler-bell" :size="20" />
          </button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent align="end" :side-offset="8" :class="[menu, 'w-[380px] max-w-[calc(100vw-32px)] p-0']">
            <p class="px-4 pb-2.5 pt-3.5 text-[15px] font-semibold">{{ t('layout.topbar.notifications') }}</p>
            <p class="border-t border-dl-line-soft px-4 py-6 text-center text-sm text-dl-muted">{{ t('layout.topbar.nothing') }}</p>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button type="button" :aria-label="t('layout.topbar.language')" :class="[trigger, 'px-3 text-[13.5px] font-semibold']">
            <DlIcon icon="tabler-world" :size="18" />
            <span class="hidden sm:inline">{{ languageName }}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" :side-offset="8" :class="[menu, 'w-[260px]']">
            <DropdownMenuRadioGroup v-model="locale">
              <DropdownMenuRadioItem v-for="language in languages" :key="language.code" :value="language.code" :class="item">
                {{ language.native_name }}
                <DropdownMenuItemIndicator class="ms-auto text-dl-cobalt"><DlIcon icon="tabler-check" :size="16" /></DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator class="my-1 h-px bg-dl-line-soft" />
            <p class="px-3 pb-2 pt-1 text-xs text-dl-muted">{{ t('layout.topbar.languageHint') }}</p>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button type="button" :aria-label="t('layout.topbar.theme')" :class="[trigger, 'w-11']">
            <DlIcon :icon="THEME_ICONS[theme]" :size="20" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" :side-offset="8" :class="[menu, 'w-[240px]']">
            <DropdownMenuRadioGroup v-model="theme">
              <DropdownMenuRadioItem v-for="choice in THEMES" :key="choice" :value="choice" :class="item">
                <DlIcon :icon="THEME_ICONS[choice]" :size="17" />
                {{ t(`layout.topbar.themes.${choice}`) }}
                <DropdownMenuItemIndicator class="ms-auto text-dl-cobalt"><DlIcon icon="tabler-check" :size="16" /></DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator class="my-1 h-px bg-dl-line-soft" />
            <p class="px-3 pb-2 pt-1 text-xs text-dl-muted">{{ t('layout.topbar.themeHint') }}</p>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            :aria-label="t('layout.topbar.account')"
            class="flex h-11 w-11 items-center justify-center rounded-xl bg-dl-cobalt text-sm font-bold text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt focus-visible:ring-offset-2"
          >
            {{ auth.user?.initials }}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" :side-offset="8" :class="[menu, 'w-[260px]']">
            <div class="flex items-center gap-3 px-3 py-2.5">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-dl-cobalt text-xs font-bold text-white">{{ auth.user?.initials }}</span>
              <span class="flex min-w-0 flex-col">
                <span class="truncate text-sm font-semibold">{{ auth.user?.name }}</span>
                <span class="truncate text-xs text-dl-muted">{{ auth.user?.email }}</span>
              </span>
            </div>
            <DropdownMenuSeparator class="my-1 h-px bg-dl-line-soft" />
            <DropdownMenuItem :class="item" @select="router.push({ name: 'tenant-profile' })">
              <DlIcon icon="tabler-user" :size="17" />
              {{ t('layout.topbar.myProfile') }}
            </DropdownMenuItem>
            <DropdownMenuItem :class="item" @select="signOut">
              <DlIcon icon="tabler-logout" :size="17" />
              {{ t('auth.logout') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>

    <LabSearch v-model:open="searching" />
  </header>
</template>
