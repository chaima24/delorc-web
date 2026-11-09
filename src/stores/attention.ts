import { defineStore } from 'pinia'
import { ref } from 'vue'
import { attentionApi, type AttentionItem } from '@/api/central/attention'

const EVERY = 5 * 60 * 1000

/** Where each item opens: its list with the filter already set. */
export const ATTENTION_LINKS = {
  labs_in_grace: { name: 'central-labs', query: { period: 'grace' } },
  trials_ending: { name: 'central-labs', query: { period: 'trial', ending: '1' } },
  near_limit: { name: 'central-usage', query: { near: '1' } },
} as const

export const ATTENTION_ICONS = { labs_in_grace: 'tabler-hourglass', trials_ending: 'tabler-clock', near_limit: 'tabler-alert-triangle' } as const

/** Grace and limits are urgent (amber); a trial ending is only information. */
export const isUrgent = (key: string) => key !== 'trials_ending'

/**
 * "Needs attention", shared by the bell and the row on Labs. The API works it out at each call;
 * here it is loaded once, then again every 5 minutes, like a small cache with a 5-minute TTL.
 */
export const useAttentionStore = defineStore('attention', () => {
  const items = ref<AttentionItem[]>([])
  let timer: number | undefined

  async function load(): Promise<void> {
    items.value = await attentionApi.list().catch(() => items.value)
  }

  function start(): void {
    if (timer === undefined) {
      load()
      timer = window.setInterval(load, EVERY)
    }
  }

  function stop(): void {
    window.clearInterval(timer)
    timer = undefined
    items.value = []
  }

  return { items, load, start, stop }
})
