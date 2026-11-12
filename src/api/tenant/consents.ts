import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'
import type { HcpType } from '@/api/tenant/hcps'

/** Consents (docs/api/consents.md): asked by someone, answered by the professional on a private link. */
export type ConsentState = 'given' | 'refused' | 'waiting' | 'inactive'
export const CONSENT_STATES: ConsentState[] = ['given', 'refused', 'waiting', 'inactive']

export interface Consent {
  id: number
  state: ConsentState
  /** Null until they answer. */
  approval: boolean | null
  is_active: boolean
  /** Answered: kept as proof (no delete). */
  is_signed: boolean
  hcp?: { id: number; name: string; type: HcpType; email: string | null; commune: string | null } | null
  requested_by?: { id: number; full_name: string } | null
  visit_id?: number | null
  /** The private link, only while waiting. */
  link: string | null
  /** What they confirmed. */
  email?: string | null
  phone?: string | null
  signed_at?: string | null
  contacted_by?: 'phone' | 'email' | null
  verified_via?: 'record' | 'given' | null
  verified_channel?: 'email' | 'sms' | null
  verified_to?: string | null
  ip_address?: string | null
  user_agent?: string | null
  has_signature?: boolean
  /** The panel only: the PNG drawn on screen. */
  signature?: string | null
  created_at?: string | null
}

export type ConsentCounts = Record<ConsentState | 'all', number>

/** What the public page shows (no session). */
export interface ConsentLinkView {
  lab: string
  name: string | null
  email: string | null
  phone: string | null
  state: ConsentState
  /** Where a code would go by each channel (masked), or null: they type one. */
  code_to: { email: string | null; sms: string | null }
  sms_available: boolean
  contacted_by: 'phone' | 'email' | 'other' | null
}

export type ConsentCodeChannel = 'email' | 'sms'

const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchConsents = (params?: ListParams) =>
  client.get<{ data: Consent[]; meta: { total: number } }>('/consents', { params })
    .then((response): Page<Consent> => ({ items: response.data.data, total: response.data.meta.total }))

export const fetchConsentStateCounts = (params?: ListParams) => data<ConsentCounts>(client.get('/consents/state-counts', { params }))

export const fetchConsent = (id: number) => data<Consent>(client.get(`/consents/${id}`))

export const createConsent = (payload: { hcp_id: number }) => data<Consent>(client.post('/consents', payload))

export const updateConsent = (id: number, payload: { is_active: boolean }) => data<Consent>(client.put(`/consents/${id}`, payload))

export const deleteConsent = (id: number) => client.delete(`/consents/${id}`)

export const sendConsentLink = (id: number, email?: string) => data<{ sent_to: string }>(client.post(`/consents/${id}/send`, { email: email || undefined }))

export const fetchConsentLink = (token: string) => data<ConsentLinkView>(client.get(`/consent-links/${token}`))

export const sendConsentCode = (token: string, channel: ConsentCodeChannel, to?: string | null) =>
  data<{ sent_to: string; channel: ConsentCodeChannel; via: 'record' | 'given'; wait: number }>(client.post(`/consent-links/${token}/code`, { channel, to: to || undefined }))

export const answerConsentLink = (token: string, payload: { approval: boolean; code: string; email?: string | null; phone?: string | null; signature?: string | null; contacted_by?: 'phone' | 'email' }) =>
  data<ConsentLinkView>(client.post(`/consent-links/${token}`, payload))
