import { client } from '@/api/client'

export interface LabInfo {
  id: string
  name: string
  logo_url: string | null
}

export const labApi = {
  /** Public. 404: no lab at this address. 403: the lab is suspended. */
  show: () => client.get<{ data: LabInfo }>('/lab').then((response) => response.data.data),
}
