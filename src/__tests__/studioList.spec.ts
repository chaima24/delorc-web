import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'

describe('Studio lists', () => {
  it('asks the server for one page with the search, sort and filters, and starts again at page 1 on a filter', async () => {
    const load = vi.fn<(query: unknown) => Promise<{ items: { id: number }[]; total: number }>>().mockResolvedValue({ items: [{ id: 1 }], total: 58 })
    const list = useStudioList<{ id: number }, { region: number | null }>(load, { region: null })

    await list.reload()
    expect(load).toHaveBeenLastCalledWith({ page: 1, perPage: 25, search: '', sort: '-id', filters: { region: null } })
    expect(list.total.value).toBe(58)

    list.page.value = 2
    await flushPromises()
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    list.filters.region = 3
    await flushPromises()
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, filters: { region: 3 } }))
  })

  it('filters, sorts and pages a short list in the browser', async () => {
    const rows = [{ id: 1, name: 'VM' }, { id: 2, name: 'KAM' }, { id: 3, name: 'Coordinator' }]
    const list = useStudioList<{ id: number; name: string }, Record<string, never>>({
      load: async () => rows,
      matches: (row, search) => row.name.toLocaleLowerCase().includes(search),
      sortValues: { id: row => row.id, name: row => row.name },
    }, {})

    await list.reload()
    expect(list.items.value.map(row => row.id)).toEqual([3, 2, 1]) // newest first
    list.sort.value = 'name'
    expect(list.items.value.map(row => row.name)).toEqual(['Coordinator', 'KAM', 'VM'])
    list.search.value = 'vm'
    expect(list.total.value).toBe(1)
  })
})
