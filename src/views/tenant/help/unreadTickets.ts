import { ref } from 'vue'
import { fetchUnreadTickets } from '@/api/tenant/tickets'

/** The red number on « ? »: my tickets with a message from support I haven't read. Shared by the top bar and the ticket page. */
export const unreadTickets = ref(0)

export async function refreshUnreadTickets(): Promise<void> {
  unreadTickets.value = await fetchUnreadTickets().catch(() => unreadTickets.value)
}
