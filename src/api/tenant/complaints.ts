import { client } from '@/api/client'
import { ticketForm, type ConversationMessage, type TicketStatus } from '@/api/central/tickets'
import type { ListParams, Page } from '@/api/tenant/geography'

/** Réclamations (delorc-api docs/api/complaints.md): a lab user's complaint about work, handled by `complaints.handle`. */

export type ComplaintUrgency = 'normal' | 'urgent'
export type ComplaintCounts = Record<'waiting' | 'resolved' | 'closed', number>

export interface Complaint {
  id: number
  number: string
  title: string
  status: TicketStatus
  urgency: ComplaintUrgency
  category: { id: number; name: string }
  anonymous: boolean
  /** Null for a handler when the author sent it without their name. */
  user: { id: number; name: string } | null
  concerned_user?: { id: number; name: string } | null
  taken_by?: { id: number; name: string } | null
  /** Only on the page. */
  messages?: ConversationMessage[]
  /** Only on the page: the viewer is the author. */
  mine?: boolean
  can?: { write: boolean; take: boolean; resolve: boolean; close: boolean; reopen: boolean }
  created_at: string
}

export interface ComplaintForm {
  categories: { id: number; name: string }[]
  people: { id: number; name: string }[]
  anonymous_allowed: boolean
}

export interface NewComplaint {
  title: string
  category_id: number
  urgency: ComplaintUrgency
  body: string
  concerned_user_id: number | null
  anonymous: boolean
}

export interface ComplaintCategory { id: number; name: string; sort: number; is_active: boolean; complaints_count?: number }

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then(response => response.data.data)
const URL = '/complaints'

/** `inbox` = À traiter (complaints.handle); otherwise Mes réclamations. */
export const fetchComplaints = (inbox: boolean, params?: ListParams) =>
  client.get<{ data: Complaint[]; meta: { total: number; status_counts: ComplaintCounts } }>(inbox ? `${URL}/inbox` : URL, { params })
    .then((response): Page<Complaint> & { counts: ComplaintCounts } => ({
      items: response.data.data, total: response.data.meta.total, counts: response.data.meta.status_counts,
    }))
export const fetchComplaintForm = () => one<ComplaintForm>(client.get(`${URL}/form`))
export const fetchComplaint = (id: number) => one<Complaint>(client.get(`${URL}/${id}`))
export const sendComplaint = (complaint: NewComplaint, files: File[]) => one<Complaint>(client.post(URL, ticketForm({
  ...complaint, concerned_user_id: complaint.concerned_user_id, anonymous: complaint.anonymous ? 1 : null,
}, files)))
export const writeComplaint = (id: number, body: string, files: File[]) => one<ConversationMessage>(client.post(`${URL}/${id}/messages`, ticketForm({ body }, files)))
export const moveComplaint = (id: number, move: 'take' | 'resolve' | 'close' | 'reopen') => one<Complaint>(client.post(`${URL}/${id}/${move}`))

// Réclamations › Réglages
export const fetchComplaintCategories = () => one<ComplaintCategory[]>(client.get('/complaint-categories'))
export const createComplaintCategory = (payload: { name: string }) => one<ComplaintCategory>(client.post('/complaint-categories', payload))
export const updateComplaintCategory = (id: number, payload: { name?: string; sort?: number; is_active?: boolean }) =>
  one<ComplaintCategory>(client.put(`/complaint-categories/${id}`, payload))
export const deleteComplaintCategory = (id: number) => client.delete(`/complaint-categories/${id}`)
export const fetchComplaintSettings = () => one<{ anonymous_allowed: boolean }>(client.get('/complaint-settings'))
export const saveComplaintSettings = (anonymous_allowed: boolean) => one<{ anonymous_allowed: boolean }>(client.put('/complaint-settings', { anonymous_allowed }))
