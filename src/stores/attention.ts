import { defineStore } from 'pinia'
import { ref } from 'vue'
import { attentionApi, type AttentionItem } from '@/api/central/attention'

const EVERY = 5 * 60 * 1000

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
