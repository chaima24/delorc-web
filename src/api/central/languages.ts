import { client } from '@/api/client'

export interface Language {
  id: number
  code: string
  name: string
  native_name: string
  direction: 'ltr' | 'rtl'
  locale: string
  fallback: string | null
  is_active: boolean
  texts_done: number
  texts_missing: number
  percent_done: number
  created_at: string
}

export type NewLanguage = Pick<Language, 'code' | 'name' | 'native_name' | 'direction' | 'locale' | 'fallback'>
export type LanguageChanges = Partial<Omit<NewLanguage, 'code'> & Pick<Language, 'is_active'>>

const one = (response: { data: { data: Language } }) => response.data.data

export const languagesApi = {
  list: () => client.get<{ data: Language[] }>('/languages').then((response) => response.data.data),
  create: (language: NewLanguage) => client.post('/languages', language).then(one),
  update: (code: string, changes: LanguageChanges) => client.put(`/languages/${code}`, changes).then(one),
  remove: (code: string) => client.delete(`/languages/${code}`),
}
