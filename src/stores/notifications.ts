import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchUnreadCount } from '@/api/tenant/notifications'

const EVERY = 60 * 1000

/**
 * The red number on the lab's bell (delorc-api docs/api/notifications.md). Polling, not real time: asked when the
 * lab layout opens, then every minute, and again when the tab gets the focus back. Like the central "Needs
 * attention" store, with a 1-minute timer. A failed call keeps the last number.
 */
export const useNotificationStore = defineStore('notifications', () => {
  const unread = ref(0)
  let timer: number | undefined

  async function load(): Promise<void> {
    unread.value = await fetchUnreadCount().catch(() => unread.value)
  }

  function start(): void {
    if (timer !== undefined) return
    load()
    timer = window.setInterval(load, EVERY)
    window.addEventListener('focus', load)
  }

  function stop(): void {
    window.clearInterval(timer)
    window.removeEventListener('focus', load)
    timer = undefined
    unread.value = 0
  }

  return { unread, load, start, stop }
})
