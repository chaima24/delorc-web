import { client } from '@/api/client'
import { ticketForm, type Ticket, type TicketMessage } from '@/api/central/tickets'
import type { ListParams, Page } from '@/api/tenant/geography'

/** Aide › Mes tickets (delorc-api docs/api/e-tickets.md): the lab's side of the tickets Delorc support answers. */

export type LabCounts = Record<'waiting' | 'resolved' | 'closed', number>

/** The « Nouveau ticket » panel's lists, in the user's language. */
export interface TicketFormLists {
  categories: { id: number; name: string }[]
  priorities: { id: number; name: string; hours: number }[]
}

export interface NewTicket { title: string; category_id: number; priority_id: number; description: string; page: string | null }

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then(response => response.data.data)
const URL = '/e-tickets'

export const fetchTickets = (params?: ListParams) =>
  client.get<{ data: Ticket[]; meta: { total: number; status_counts: LabCounts } }>(URL, { params })
    .then((response): Page<Ticket> & { counts: LabCounts } => ({
      items: response.data.data, total: response.data.meta.total, counts: response.data.meta.status_counts,
    }))
export const fetchUnreadTickets = () => one<{ count: number }>(client.get(`${URL}/unread`)).then(answer => answer.count)
export const fetchTicketForm = () => one<TicketFormLists>(client.get(`${URL}/form`))
export const fetchTicket = (id: number) => one<Ticket>(client.get(`${URL}/${id}`))
export const createTicket = (ticket: NewTicket, files: File[]) => one<Ticket>(client.post(URL, ticketForm({ ...ticket }, files)))
export const writeTicket = (id: number, body: string, files: File[]) => one<TicketMessage>(client.post(`${URL}/${id}/messages`, ticketForm({ body }, files)))
export const closeTicket = (id: number) => one<Ticket>(client.post(`${URL}/${id}/close`))
export const reopenTicket = (id: number, message: string | null) => one<Ticket>(client.post(`${URL}/${id}/reopen`, { message }))
