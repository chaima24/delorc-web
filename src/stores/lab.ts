import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isAxiosError } from 'axios'
import { labApi, type LabInfo } from '@/api/tenant/lab'
import { savedLocale, setLocale, useLabLanguages } from '@/plugins/i18n'

/**
 * The lab of this address, asked once before any lab page opens, like a middleware that checks the tenant.
 * `unknown`: no lab here (404). `suspended`: the lab exists but is suspended (403).
 */
export const useLabStore = defineStore('lab', () => {
  const lab = ref<LabInfo | null>(null)
  const state = ref<'ok' | 'unknown' | 'suspended'>('ok')
  let loaded = false

  /** Then switches the texts to the lab's own: the language this browser used last time, else the lab's default. */
  async function load(): Promise<void> {
    if (loaded) return
    loaded = true

    try {
      lab.value = await labApi.show()
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined
      // Any other failure (API down…) keeps the sign-in page, which shows its own error.
      if (status === 404) state.value = 'unknown'
      if (status === 403) state.value = 'suspended'
      return
    }

    useLabLanguages({ codes: lab.value.languages.map((language) => language.code), load: labApi.texts })
    await setLocale(savedLocale() ?? lab.value.default_language).catch(() => undefined) // no texts: the central ones stay
  }

  return { lab, state, load }
})
