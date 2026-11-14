import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'
import type { Person } from '@/api/tenant/campaigns'

/**
 * Campaigns, part 12b (docs/api/campaign-messages.md): a campaign's emails and SMS (written, marked ready, approved by
 * a second person), the lab's templates (Engager › Modèles), the preview and the email look.
 */

export type MailChannel = 'email' | 'sms'
export type MessageStatus = 'draft' | 'ready' | 'returned' | 'approved'
/** The fields a text may hold, stored as `{{CODE}}`, shown as chips. */
export const MAIL_FIELDS = ['CAMPAIGN_NAME', 'CAMPAIGN_CODE', 'YEAR', 'RECIPIENT_NAME'] as const
export type MailField = (typeof MAIL_FIELDS)[number]

export interface MailFile { id: number; name: string | null; url: string | null; mime: string | null; size: number | null }

export interface MailTemplate {
  id: number
  channel: MailChannel
  label: string
  brand: { id: number; name: string } | null
  subject: string | null
  body: string
  is_active: boolean
  attachments_count?: number
  messages_count?: number
  attachments?: MailFile[]
  created_by?: Person | null
  created_at: string | null
}

export interface MailTemplatePayload {
  channel?: MailChannel
  label?: string
  brand_id?: number | null
  subject?: string | null
  body?: string | null
  is_active?: boolean
  attachments?: File[]
}

export interface HistoryLine { event: 'created' | MessageStatus; by: string | null; at: string; reason: string | null; template: string | null }

export interface CampaignMessage {
  id: number
  campaign?: { id: number; code: string; name: string }
  channel: MailChannel
  status: MessageStatus
  subject: string | null
  body: string | null
  template: { id: number; label: string } | null
  return_reason: string | null
  attachments_count?: number
  attachments?: MailFile[]
  created_by: Person | null
  updated_by: Person | null
  approved_by: Person | null
  approved_at: string | null
  updated_at: string | null
  can: { update: boolean; approve: boolean; approve_reason: string | null }
  history?: HistoryLine[]
}

export interface MessagePayload { subject?: string | null; body?: string | null; attachments?: File[] }

export interface EmailLook { email_color: string; email_footer: string; email_logo_url: string | null }

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } }

/** With files: multipart, read by Laravel as a PUT through `_method` (multipart can't travel as PUT). */
function put<T>(url: string, payload: object & { attachments?: File[] }) {
  if (!payload.attachments?.length) return one<T>(client.put(url, payload))
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'attachments' || value === undefined) continue
    form.append(key, value === null ? '' : typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  payload.attachments.forEach((file, i) => form.append(`attachments[${i}]`, file))
  form.append('_method', 'PUT')
  return one<T>(client.post(url, form, multipart))
}
const image = (url: string, file: File) => {
  const form = new FormData()
  form.append('image', file)
  return one<{ id: number; url: string }>(client.post(url, form, multipart))
}

// Templates (Engager › Modèles)
export const fetchMailTemplates = (params?: ListParams) =>
  client.get<{ data: MailTemplate[]; meta: { total: number } }>('/mail-templates', { params })
    .then((response): Page<MailTemplate> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchMailTemplate = (id: number) => one<MailTemplate>(client.get(`/mail-templates/${id}`))
export const createMailTemplate = (payload: MailTemplatePayload) => one<MailTemplate>(client.post('/mail-templates', payload))
export const updateMailTemplate = (id: number, payload: MailTemplatePayload) => put<MailTemplate>(`/mail-templates/${id}`, payload)
export const deleteMailTemplate = (id: number) => client.delete(`/mail-templates/${id}`)
export const deleteMailTemplateFile = (id: number, fileId: number) => one<MailTemplate>(client.delete(`/mail-templates/${id}/attachments/${fileId}`))
export const uploadMailTemplateImage = (id: number, file: File) => image(`/mail-templates/${id}/images`, file)
export const testMailTemplate = (id: number) => client.post(`/mail-templates/${id}/test`)

// A campaign's messages
export const fetchCampaignMessages = (campaignId: number, params?: Record<string, string | undefined>) =>
  client.get<{ data: CampaignMessage[] }>(`/campaigns/${campaignId}/messages`, { params }).then((response) => response.data.data)
export const fetchCampaignMessage = (id: number) => one<CampaignMessage>(client.get(`/campaign-messages/${id}`))
export const createCampaignMessage = (payload: { campaign_id: number; channel: MailChannel; mail_template_id?: number | null }) =>
  one<CampaignMessage>(client.post('/campaign-messages', payload))
export const updateCampaignMessage = (id: number, payload: MessagePayload) => put<CampaignMessage>(`/campaign-messages/${id}`, payload)
export const deleteCampaignMessage = (id: number) => client.delete(`/campaign-messages/${id}`)
export const deleteCampaignMessageFile = (id: number, fileId: number) => one<CampaignMessage>(client.delete(`/campaign-messages/${id}/attachments/${fileId}`))
export const uploadCampaignMessageImage = (id: number, file: File) => image(`/campaign-messages/${id}/images`, file)
export const markMessageReady = (id: number) => one<CampaignMessage>(client.post(`/campaign-messages/${id}/ready`))
export const approveMessage = (id: number) => one<CampaignMessage>(client.post(`/campaign-messages/${id}/approve`))
export const sendMessageBack = (id: number, reason: string) => one<CampaignMessage>(client.post(`/campaign-messages/${id}/return`, { reason }))
export const testCampaignMessage = (id: number) => client.post(`/campaign-messages/${id}/test`)

// The preview beside the editor
export const previewEmail = (payload: { subject: string; body: string; campaign_id?: number }) =>
  one<{ subject: string; html: string }>(client.post('/mail-preview', { channel: 'email', ...payload }))
export const previewSms = (payload: { body: string; campaign_id?: number }) =>
  one<{ text: string; length: number; parts: number }>(client.post('/mail-preview', { channel: 'sms', ...payload }))

// The email look, inside "⚙ Réglages des campagnes"
export function saveEmailLook(settings: { priority_required: boolean; message_required: boolean }, look: { email_color: string; email_footer: string; email_logo?: File | null; remove_logo?: boolean }) {
  const form = new FormData()
  form.append('priority_required', settings.priority_required ? '1' : '0')
  form.append('message_required', settings.message_required ? '1' : '0')
  form.append('email_color', look.email_color)
  form.append('email_footer', look.email_footer)
  if (look.email_logo) form.append('email_logo', look.email_logo)
  if (look.remove_logo) form.append('remove_logo', '1')
  form.append('_method', 'PUT')
  return one<EmailLook & { priority_required: boolean; message_required: boolean }>(client.post('/campaign-settings', form, multipart))
}
