import { client } from '@/api/client'

export type TextState = 'done' | 'missing' | 'check'

/** A row of the list. `texts` with no language chosen; the others with a language. */
export interface TextRow {
  key: string
  used_in: 'web' | 'api' | 'mail'
  note: string | null
  texts?: Record<string, string | null>
  reference?: string | null
  value?: string | null
  shown?: string | null
  state?: TextState
}

export interface TextSummary {
  total: number
  done: number
  missing: number
  check: number
  percent_done: number
}

export interface TextFilters {
  language?: string
  search?: string
  used_in?: string
  state?: string
  sort?: string
}

export interface TextDetail {
  key: string
  used_in: TextRow['used_in']
  note: string | null
  texts: {
    language: string
    value: string | null
    state: TextState
    updated_by: { id: number; name: string } | null
    updated_at: string | null
  }[]
}

export interface TextToSave {
  language: string
  key: string
  value: string | null
}

export interface ImportResult {
  languages_added: number
  keys_added: number
  texts_added: number
  texts_unchanged: number
}

export const translationsApi = {
  list: (filters: TextFilters, page: number, perPage: number) => {
    const params: Record<string, string | number> = { page, per_page: perPage }
    if (filters.language) params.language = filters.language
    if (filters.search) params['filter[search]'] = filters.search
    if (filters.used_in) params['filter[used_in]'] = filters.used_in
    if (filters.state) params['filter[state]'] = filters.state
    if (filters.sort) params.sort = filters.sort

    return client.get<{ data: TextRow[]; meta: { total: number }; summary: TextSummary }>('/translations', { params }).then((response) => response.data)
  },
  get: (key: string) => client.get<{ data: TextDetail }>(`/translations/${key}`).then((response) => response.data.data),
  save: (texts: TextToSave[]) => client.put('/translations', { texts }),
  export: () => client.get<Blob>('/translations/export', { responseType: 'blob' }).then((response) => response.data),
  import: (file: File) => {
    const body = new FormData()
    body.append('file', file)

    return client.post<{ data: ImportResult }>('/translations/import', body).then((response) => response.data.data)
  },
}
