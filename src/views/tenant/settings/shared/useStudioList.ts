import { computed, reactive, ref, shallowRef, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { studioApi, type StudioCounts } from '@/api/tenant/studio'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

export const STUDIO_PER_PAGE = 25
const PAGE_SIZE_KEY = 'delorc.page_size'

/** The viewer's last "rows per page" choice, shared by every Studio list. */
function readPageSize(): number {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
    return [10, 25, 50, 100].includes(saved) ? saved : STUDIO_PER_PAGE
  } catch {
    return STUDIO_PER_PAGE
  }
}

/** Newest first, unless the user sorts by a column. */
export const STUDIO_DEFAULT_SORT = '-id'

/** "Added" column: shows the creation date, sorts by id (same order as creation). */
export function useAddedColumn() {
  const { t, d } = useI18n()
  const column = { key: 'created_at', label: t('studio.list.added'), sortKey: 'id' }
  const format = (value?: string | null) => (value ? d(new Date(value), { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return { column, format }
}

interface ListOptions<T, F> {
  /** Every row, from the API (a short list, loaded at once). */
  load: () => Promise<T[]>
  /** Whether a row matches the search text (already lower case) and the filters. */
  matches: (row: T, search: string, filters: F) => boolean
  /** The value each sortable column sorts on, by its sort key. */
  sortValues: Record<string, (row: T) => string | number>
}

/**
 * One page of records with search, filters, sort and paging, worked out in the browser:
 * like loading a small table once and filtering it in memory.
 */
export function useStudioList<T, F extends Record<string, string | number | null>>(options: ListOptions<T, F>, initialFilters: F) {
  const page = ref(1)
  const perPage = ref(readPageSize())
  const search = ref('')
  const sort = ref<string | null>(STUDIO_DEFAULT_SORT)
  const filters = reactive({ ...initialFilters }) as F
  const rows = shallowRef<T[]>([])
  const loading = ref(false)

  async function reload(): Promise<void> {
    loading.value = true
    try {
      rows.value = await options.load()
    } finally {
      loading.value = false
    }
  }

  const matching = computed(() => {
    const text = search.value.trim().toLocaleLowerCase()
    const found = rows.value.filter((row) => options.matches(row, text, filters as F))
    const key = (sort.value || STUDIO_DEFAULT_SORT).replace('-', '')
    const value = options.sortValues[key]
    if (!value) return found
    const descending = (sort.value || STUDIO_DEFAULT_SORT).startsWith('-')

    return [...found].sort((a, b) => {
      const [first, second] = [value(a), value(b)]
      const order = typeof first === 'string' ? first.localeCompare(String(second)) : first - Number(second)

      return descending ? -order : order
    })
  })

  const total = computed(() => matching.value.length)
  const items = computed(() => matching.value.slice((page.value - 1) * perPage.value, page.value * perPage.value))

  watch([search, () => ({ ...filters }), sort], () => { page.value = 1 })
  watch(perPage, (value) => {
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(value))
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
    page.value = 1
  })

  return { page, perPage, search, sort, filters, items, total, loading, reload }
}

/** Studio counts for the section strip; refreshed after every change. */
const counts = ref<StudioCounts | null>(null)
export function useStudioCounts() {
  async function refresh(): Promise<void> {
    try {
      counts.value = await studioApi.summary()
    } catch {
      // The strip just shows no numbers.
    }
  }
  if (!counts.value) void refresh()

  return { counts, refresh }
}

interface RecordPanelOptions<T, F> {
  /** Form values for an existing record, or for a new one when `record` is null. */
  toForm: (record: T | null) => F
  create: (form: F) => Promise<T>
  update: (record: T, form: F) => Promise<unknown>
  remove: (record: T) => Promise<unknown>
  recordName: (record: T) => string
  /** After any create, update or delete. */
  onChange: () => void
  /** Reading-mode panels: re-fetch the record after a save and keep it open (also after "Add"). */
  reload?: (record: T) => Promise<T>
}

/** The record open in the side panel, its form, and save / delete with the API's errors (422 on the fields). */
export function useRecordPanel<T extends { id: number }, F extends object>(options: RecordPanelOptions<T, F>) {
  const { t } = useI18n()
  const toast = useToast()
  const { confirm } = useConfirm()

  const open = ref(false)
  const record = shallowRef<T | null>(null)
  const form = ref(options.toForm(null)) as Ref<F>
  const errors = ref<Record<string, string>>({})
  const saving = ref(false)

  function show(row: T | null): void {
    record.value = row
    form.value = options.toForm(row)
    errors.value = {}
    open.value = true
  }

  watch(open, (value) => {
    if (!value) record.value = null
  })

  /** @returns true when saved. */
  async function save(): Promise<boolean> {
    saving.value = true
    errors.value = {}
    try {
      if (record.value) {
        await options.update(record.value, form.value)
        toast.success(t('studio.list.toast.saved'))
        if (options.reload) show(await options.reload(record.value))
      } else {
        const created = await options.create(form.value)
        toast.success(t('studio.list.toast.created'))
        if (options.reload) show(await options.reload(created))
        else open.value = false
      }
      options.onChange()

      return true
    } catch (error) {
      errors.value = fieldErrors(error)
      if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))

      return false
    } finally {
      saving.value = false
    }
  }

  /** Back to the record's saved values (e.g. "Cancel" on a section). */
  function reset(): void {
    form.value = options.toForm(record.value)
    errors.value = {}
  }

  async function destroy(): Promise<void> {
    const row = record.value
    if (!row) return
    const ok = await confirm({
      title: t('studio.list.delete.title', { name: options.recordName(row) }),
      text: t('studio.list.delete.text'),
      confirmButtonText: t('common.actions.delete'),
      icon: 'warning',
    })
    if (!ok) return
    try {
      await options.remove(row)
      toast.success(t('studio.list.toast.deleted'))
      open.value = false
      options.onChange()
    } catch (error) {
      // The API says why (e.g. "People have this role: change their role first.").
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
    }
  }

  return { open, record, form, errors, saving, show, save, reset, destroy }
}
