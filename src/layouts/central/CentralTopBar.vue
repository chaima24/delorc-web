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
} from 'reka-ui'
import DlIcon from '@/components/DlIcon.vue'
import { profileApi } from '@/api/central/profile'
import { useAccessLabels } from '@/composables/useAccessLabels'
import { THEMES, useTheme, type ThemeChoice } from '@/composables/useTheme'
import { currentLocale, LOCALES, setLocale, type Locale } from '@/plugins/i18n'
import { useAttentionStore } from '@/stores/attention'
import { useAuthStore } from '@/stores/auth'
import AttentionBell from './AttentionBell.vue'
import SearchPalette from './SearchPalette.vue'

/** Left: search. Right: needs attention, language, theme, my account. */
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { theme } = useTheme()
const { roleLabel } = useAccessLabels()

const searching = ref(false)
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

/** Each language in its own words, so anyone finds theirs. */
const LANGUAGE_NAMES = { fr: 'Français', en: 'English', ar: 'العربية' } as const
const THEME_ICONS: Record<ThemeChoice, string> = { light: 'tabler-sun', dark: 'tabler-moon', system: 'tabler-device-desktop' }

const locale = computed({
  get: () => currentLocale() as Locale, // central only shows its JSON languages
  /** Shown at once, then saved on the account, so the API and the emails use it on every device. */
  set: (value: string) => {
    setLocale(value)
    profileApi.update({ locale: value }).then((user) => { auth.user = user }).catch(() => undefined)
  },
})

async function signOut(): Promise<void> {
  useAttentionStore().stop()
  await auth.logout()
  router.push({ name: 'login' })
}

const trigger = 'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-dl-line bg-dl-paper text-dl-fg hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt'
const menu = 'z-2100 min-w-[220px] rounded-2xl border border-dl-line bg-dl-paper p-1.5 text-dl-fg shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]'
const item = 'flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-3 text-sm outline-hidden data-highlighted:bg-dl-line-soft'
</script>

<template>
  <header class="sticky top-0 z-900 flex items-center gap-2.5 border-b border-dl-line bg-dl-paper px-4 py-3 md:px-7">
    <button
      type="button"
      class="flex h-11 min-w-0 max-w-[420px] flex-1 items-center gap-2.5 rounded-[14px] border border-dl-line bg-dl-mist px-3.5 text-start text-sm text-dl-muted hover:border-dl-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
      @click="searching = true"
    >
      <DlIcon icon="tabler-search" :size="18" />
      <span class="truncate">{{ t('central.topbar.search') }}</span>
      <kbd class="ms-auto hidden rounded-md border border-dl-line px-1.5 py-0.5 font-sans text-xs sm:inline">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
    </button>

    <div class="ms-auto flex items-center gap-2.5">
      <AttentionBell />

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button type="button" :class="[trigger, 'px-3 text-[13.5px] font-semibold']">
            <DlIcon icon="tabler-world" :size="18" />
            <span class="hidden sm:inline">{{ LANGUAGE_NAMES[locale] }}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" :side-offset="8" :class="[menu, 'w-[260px]']">
            <DropdownMenuRadioGroup v-model="locale">
              <DropdownMenuRadioItem v-for="code in LOCALES" :key="code" :value="code" :class="item">
                {{ LANGUAGE_NAMES[code] }}
                <DropdownMenuItemIndicator class="ms-auto text-dl-cobalt"><DlIcon icon="tabler-check" :size="16" /></DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator class="my-1 h-px bg-dl-line-soft" />
            <p class="px-3 pb-2 pt-1 text-xs text-dl-muted">{{ t('central.topbar.languageHint') }}</p>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button type="button" :aria-label="t('central.topbar.theme')" :class="[trigger, 'w-11']">
            <DlIcon :icon="THEME_ICONS[theme]" :size="20" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" :side-offset="8" :class="[menu, 'w-[240px]']">
            <DropdownMenuRadioGroup v-model="theme">
              <DropdownMenuRadioItem v-for="choice in THEMES" :key="choice" :value="choice" :class="item">
                <DlIcon :icon="THEME_ICONS[choice]" :size="17" />
                {{ t(`central.topbar.themes.${choice}`) }}
                <DropdownMenuItemIndicator class="ms-auto text-dl-cobalt"><DlIcon icon="tabler-check" :size="16" /></DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator class="my-1 h-px bg-dl-line-soft" />
            <p class="px-3 pb-2 pt-1 text-xs text-dl-muted">{{ t('central.topbar.themeHint') }}</p>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            :aria-label="t('central.topbar.account')"
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
                <span class="truncate text-xs text-dl-muted">{{ auth.user?.role ? roleLabel(auth.user.role) : '' }}</span>
              </span>
            </div>
            <DropdownMenuSeparator class="my-1 h-px bg-dl-line-soft" />
            <DropdownMenuItem :class="item" @select="router.push({ name: 'central-profile' })">
              <DlIcon icon="tabler-user" :size="17" />
              {{ t('central.topbar.myProfile') }}
            </DropdownMenuItem>
            <DropdownMenuItem :class="item" @select="signOut">
              <DlIcon icon="tabler-logout" :size="17" />
              {{ t('auth.logout') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>

    <SearchPalette v-model:open="searching" />
  </header>
</template>
