import { ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'

/** One page of places from the API, reloaded from page 1 when a filter or the sort changes. */
export function usePlaceList<T>(load: (page: number, perPage: number) => Promise<{ data: T[]; meta: { total: number } }>, watched: Ref<unknown>[]) {
  const { t } = useI18n()
  const rows = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(25)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function reload(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const answer = await load(page.value, perPage.value)
      rows.value = answer.data
      total.value = answer.meta.total
    } catch (failure) {
      error.value = errorMessage(failure) ?? t('errors.network')
    } finally {
      loading.value = false
    }
  }

  function fromFirstPage(): void {
    if (page.value === 1) reload()
    else page.value = 1
  }

  watch([...watched, perPage], fromFirstPage)
  watch(page, reload)

  return { rows, total, page, perPage, loading, error, reload, fromFirstPage }
}

/** Waits until typing stops before searching. */
export function useTyped(text: Ref<string>, delay = 300): Ref<string> {
  const typed = ref(text.value)
  let timer: ReturnType<typeof setTimeout>
  watch(text, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => { typed.value = value }, delay)
  })

  return typed
}
