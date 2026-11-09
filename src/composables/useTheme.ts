import { computed, ref } from 'vue'

export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEMES: ThemeChoice[] = ['light', 'dark', 'system']

const STORAGE_KEY = 'delorc.theme'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

function saved(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // Storage blocked (private window): use the default.
  }

  return 'system'
}

const choice = ref<ThemeChoice>(saved())

/** Puts `.dark` on <html> when the page should be dark: Tailwind's dark variant and the dl-* tokens read it. */
function apply(): void {
  const dark = choice.value === 'dark' || (choice.value === 'system' && systemDark.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

apply()
systemDark.addEventListener('change', apply)

/** Light, dark or system, saved in this browser only (another device can stay light). */
export function useTheme() {
  return {
    theme: computed<ThemeChoice>({
      get: () => choice.value,
      set: (value) => {
        choice.value = value
        try {
          localStorage.setItem(STORAGE_KEY, value)
        } catch {
          // Not saved: it still applies until the page is reloaded.
        }
        apply()
      },
    }),
  }
}
