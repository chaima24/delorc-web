import { client } from '@/api/client'
import type { Person } from '@/api/tenant/campaigns'

/**
 * Campaigns, part 12c (docs/api/campaign-sendings.md): sending an approved email to the professionals the grid targets
 * with a given consent, now or at a quarter hour, then what each one did (sent, failed, opened, clicked, unsubscribed).
 */

export type SendingStatus = 'scheduled' | 'running' | 'done' | 'cancelled' | 'failed'
export type RecipientStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

export interface SendingCounts { recipients: number; sent: number; failed: number; opened: number; clicked: number; unsubscribed: number }

export interface SendingRecipient {
  id: number
  hcp: { id: number; name: string } | null
  email: string
  status: RecipientStatus
  error: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  clicks: number
  unsubscribed_at: string | null
}

export interface CampaignSending {
  id: number
  message?: { id: number; subject: string | null }
  subject: string
  status: SendingStatus
  failure: 'quota' | null
  scheduled_at: string
  started_at: string | null
  finished_at: string | null
  created_by?: Person | null
  created_at: string | null
  counts: SendingCounts
  /** Only on the page. */
  recipients?: SendingRecipient[]
}

/** Who the grid targets with a given consent; `why` says why one can't receive it. */
export interface SendingCandidate {
  hcp_id: number
  name: string
  type: string | null
  speciality: { id: number; name: string } | null
  wilaya: { id: number; name: string } | null
  segment: { id: number; name: string } | null
  email: string | null
  can_receive: boolean
  why: 'no_email' | 'opted_out' | null
  opted_out_at: string | null
  already_received: boolean
}

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchCampaignSendings = (campaignId: number, status?: SendingStatus) =>
  client.get<{ data: CampaignSending[]; meta: { quota: { sent: number; quota: number | null } } }>(`/campaigns/${campaignId}/sendings`, { params: { 'filter[status]': status } })
    .then((response) => ({ items: response.data.data, quota: response.data.meta.quota }))
export const fetchSendingCandidates = (campaignId: number, messageId: number) =>
  client.get<{ data: SendingCandidate[]; meta: { quota_left: number | null } }>(`/campaigns/${campaignId}/sending-recipients`, { params: { campaign_message_id: messageId } })
    .then((response) => ({ items: response.data.data, quotaLeft: response.data.meta.quota_left }))
export const createCampaignSending = (payload: { campaign_message_id: number; hcp_ids: number[]; scheduled_at?: string | null }) =>
  one<CampaignSending>(client.post('/campaign-sendings', payload))
export const fetchCampaignSending = (id: number) => one<CampaignSending>(client.get(`/campaign-sendings/${id}`))
export const cancelCampaignSending = (id: number) => one<CampaignSending>(client.post(`/campaign-sendings/${id}/cancel`))

// The public unsubscribe page (no session).
export interface UnsubscribeView { lab: string; email: string; done: boolean }
export const fetchUnsubscribe = (token: string) => one<UnsubscribeView>(client.get(`/unsubscribe/${token}`))
export const confirmUnsubscribe = (token: string) => one<UnsubscribeView>(client.post(`/unsubscribe/${token}`))
