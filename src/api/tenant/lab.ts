import { client } from '@/api/client'

export interface LabLanguage {
  code: string
  native_name: string
  direction: 'ltr' | 'rtl'
}

/** The lab of this address, read before anyone signs in. */
export interface LabInfo {
  id: string
  name: string
  logo_url: string | null
  default_language: string
  languages: LabLanguage[]
}

/** Every web text of the lab in one language, flat keys: `{ "auth.login.title": "Bon retour" }`. */
export interface LabTexts {
  language: string
  direction: 'ltr' | 'rtl'
  texts: Record<string, string>
}

/** Both routes are public. The browser keeps the texts and asks again with their ETag (304 when unchanged). */
export const labApi = {
  /** 404: no lab at this address. 403: the lab is suspended. */
  show: () => client.get<{ data: LabInfo }>('/lab').then((response) => response.data.data),
  texts: (language: string) =>
    client.get<{ data: LabTexts }>('/texts', { params: { language } }).then((response) => response.data.data),
}
