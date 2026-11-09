import { defineStore } from 'pinia'
import axios from 'axios'
import { ref } from 'vue'
import { errorMessage } from '@/api/errors'
import { labApi, type Lab } from '@/api/tenant/lab'
import { savedLocale, setLocale, useLabLanguages } from '@/plugins/i18n'

/** The lab of this address (name, languages), read once before the app opens. Empty on central. */
export const useLabStore = defineStore('lab', () => {
  const lab = ref<Lab | null>(null)
  /** The API's answer when this address is not a lab (404) or a suspended one (403): shown instead of the sign-in form. */
  const unavailable = ref<{ status: 404 | 403; message: string } | null>(null)

  /**
   * Reads the lab, then switches the texts to the lab's own: the language this browser used last time,
   * else the lab's default language. Like a boot step that runs before the first request is served.
   */
  async function load(): Promise<void> {
    try {
      lab.value = await labApi.show()
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      if (status === 404 || status === 403) {
        unavailable.value = { status, message: errorMessage(error) ?? '' }
        return
      }
      throw error // no network: the sign-in form opens as usual
    }

    useLabLanguages({ codes: lab.value.languages.map((language) => language.code), load: labApi.texts })
    await setLocale(savedLocale() ?? lab.value.default_language)
  }

  return { lab, unavailable, load }
})
