import { client } from '@/api/client'

/**
 * E-tickets (delorc-api docs/api/e-tickets.md). A lab user reports a problem with the app; Delorc support answers from
 * the console. The types are shared by the lab (`api/tenant/tickets.ts`) and central.
 */

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']

/** A state line of the conversation; `null` for a plain message. */
export type TicketEvent = 'opened' | 'taken' | 'resolved' | 'closed' | 'reopened' | 'changed' | 'auto_closed'

export interface TicketFile { id: number; name: string; url: string; mime: string | null; size: number | null }

export interface TicketMessage {
  id: number
  side: 'lab' | 'support'
  by: string | null
  event: TicketEvent | null
  body: string | null
  changes: Record<string, { old: string; new: string }> | null
  files: TicketFile[]
  at: string
}

export interface Ticket {
  id: number
  number: string
  title: string
  status: TicketStatus
  late: boolean
  due_at: string
  category: { id: number; name: string }
  priority: { id: number; name: string; hours: number }
  page: string | null
  user: { id: number; name: string }
  /** Central only. */
  lab?: { id: string; name: string }
  /** The lab's list, for the author's own rows. */
  unread?: boolean
  /** Only on the page. */
  messages?: TicketMessage[]
  taken_by?: { id: number; name: string } | null
  taken_at: string | null
  resolved_at: string | null
  closed_at: string | null
  closes_on?: string | null
  can?: Record<string, boolean>
  created_at: string
}

/** An item of Central › Tickets › Settings. */
export interface TicketListItem {
  id: number
  names: { fr: string; en?: string | null; ar?: string | null }
  name: string
  hours?: number
  sort: number
  is_active: boolean
  tickets_count?: number
}
export type TicketListKind = 'ticket-categories' | 'ticket-priorities'
export type TicketListPayload = Partial<Pick<TicketListItem, 'names' | 'hours' | 'sort' | 'is_active'>>

export interface TicketSettings { support_email: string | null; close_after_days: number; reopen_days: number }

export type CentralCounts = Record<'waiting' | TicketStatus | 'all', number>

/** A message or a ticket with files goes as a form (multipart). */
export function ticketForm(fields: Record<string, string | number | null | undefined>, files: File[]): FormData {
  const form = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') form.append(key, String(value))
  })
  files.forEach(file => form.append('files[]', file))

  return form
}

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then(response => response.data.data)

export const ticketsApi = {
  list: (params: Record<string, string | number | undefined>) =>
    client.get<{ data: Ticket[]; meta: { total: number; status_counts: CentralCounts } }>('/tickets', { params })
      .then(response => ({ items: response.data.data, total: response.data.meta.total, counts: response.data.meta.status_counts })),
  get: (id: number) => one<Ticket>(client.get(`/tickets/${id}`)),
  update: (id: number, changes: { category_id?: number; priority_id?: number }) => one<Ticket>(client.put(`/tickets/${id}`, changes)),
  answer: (id: number, body: string, files: File[]) => one<TicketMessage>(client.post(`/tickets/${id}/messages`, ticketForm({ body }, files))),
  take: (id: number) => one<Ticket>(client.post(`/tickets/${id}/take`)),
  resolve: (id: number, message: string | null) => one<Ticket>(client.post(`/tickets/${id}/resolve`, { message })),
  close: (id: number, message: string | null) => one<Ticket>(client.post(`/tickets/${id}/close`, { message })),

  items: (kind: TicketListKind) => one<TicketListItem[]>(client.get(`/${kind}`)),
  addItem: (kind: TicketListKind, payload: TicketListPayload) => one<TicketListItem>(client.post(`/${kind}`, payload)),
  updateItem: (kind: TicketListKind, id: number, payload: TicketListPayload) => one<TicketListItem>(client.put(`/${kind}/${id}`, payload)),
  deleteItem: (kind: TicketListKind, id: number) => client.delete(`/${kind}/${id}`),

  settings: () => one<TicketSettings>(client.get('/ticket-settings')),
  saveSettings: (changes: Partial<TicketSettings>) => one<TicketSettings>(client.put('/ticket-settings', changes)),
}
