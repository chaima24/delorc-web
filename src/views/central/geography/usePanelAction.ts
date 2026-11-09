import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'

/** Runs one API call from a panel and keeps its field errors or its message. */
export function usePanelAction() {
  const { t } = useI18n()
  const errors = ref<Record<string, string>>({})
  const error = ref<string | null>(null)
  const busy = ref(false)

  async function run<T>(action: () => Promise<T>, done: (result: T) => void): Promise<void> {
    busy.value = true
    errors.value = {}
    error.value = null
    try {
      done(await action())
    } catch (failure) {
      errors.value = fieldErrors(failure)
      if (!Object.keys(errors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
    } finally {
      busy.value = false
    }
  }

  function clear(): void {
    errors.value = {}
    error.value = null
  }

  return { errors, error, busy, run, clear }
}

/** An empty box sends null; a typed number is sent as a number. */
export const numberOrNull = (value: string | number | null | undefined) => (value === '' || value === null || value === undefined ? null : Number(value))
