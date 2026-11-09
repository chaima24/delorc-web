import { client } from '@/api/client'

/** Record counts per Studio setting, keyed by table name (`roles`, `users`…). */
export type StudioCounts = Record<string, number>

export const studioApi = {
  summary: () => client.get<{ data: { counts: StudioCounts } }>('/studio/summary').then((response) => response.data.data.counts),
}
