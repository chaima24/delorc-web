import { client } from '@/api/client'

export type AttentionKey = 'labs_in_grace' | 'trials_ending' | 'near_limit'

/** One line of the bell. `labs`: at most 3, the most urgent first. */
export interface AttentionItem {
  key: AttentionKey
  count: number
  labs: { id: string; name: string; date?: string; metric?: 'accounts' | 'emails' | 'storage'; percent?: number }[]
}

export const attentionApi = {
  list: () => client.get<{ data: AttentionItem[] }>('/attention').then((response) => response.data.data),
}
