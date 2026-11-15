import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/**
 * Campaigns, part 12a (docs/api/campaigns.md): a campaign (code, dates, teams, objective) and its promo grid
 * (which brands each team presents to which specialities, with a priority and a message).
 */

export type CampaignState = 'upcoming' | 'current' | 'ended'
export interface PriorityRef { id: number; name: string; color: string; order: number }
export interface Person { id: number; full_name: string }

export interface CampaignTeam {
  id: number
  name: string
  /** Only on the page. */
  ticks_count?: number
  members_count?: number
  /** The first 3 current members. */
  members?: Person[]
  specialities?: { id: number; name: string }[]
}

export interface Campaign {
  id: number
  code: string
  name: string
  start_date: string
  end_date: string
  state: CampaignState
  objective: string
  comment: string | null
  teams: CampaignTeam[]
  /** The list. */
  ticks_count?: number
  /** The page: its emails and SMS (docs/api/campaign-messages.md). */
  messages_count?: number
  /** The page: its sendings (docs/api/campaign-sendings.md). */
  sendings_count?: number
  /** The page: its material distributions (docs/api/materials.md). */
  materials_count?: number
  events_count?: number
  /** The page: figures read from the grid. */
  figures?: { ticks: number; brands: number; specialities: number; with_message: number; emails_sent: number }
  promoted?: { brand: { id: number; name: string }; ticks: number; by_priority: { priority: PriorityRef | null; count: number }[] }[]
  created_by?: Person | null
  created_at: string | null
}

export interface CampaignPayload {
  name?: string
  start_date?: string
  end_date?: string
  objective?: string
  comment?: string | null
  team_ids?: number[]
}

export interface CampaignTick {
  id: number
  team_id: number
  brand_id: number
  speciality_id: number
  priority: PriorityRef | null
  message: string | null
}

export interface CampaignSettings { priority_required: boolean; message_required: boolean }
/** GET also answers the email look (docs/api/campaign-messages.md). */
export type CampaignSettingsRead = CampaignSettings & { email_color: string; email_footer: string; email_logo_url: string | null; material_period: 'campaign' | 'cycle'; material_leftover: 'stays' | 'ends' }

export interface CampaignGrid {
  teams: (Required<Omit<CampaignTeam, 'specialities'>> & { specialities: { id: number; name: string }[]; brand_ids: number[] | null })[]
  brands: { id: number; name: string }[]
  ticks: CampaignTick[]
  settings: CampaignSettings
}

export interface CopyPreview {
  teams: { id: number; name: string }[]
  copied: number
  replaced: number
  skipped: { team: string; brand: string; speciality: string; why: 'brand' | 'speciality' }[]
}

export interface PromoLine {
  campaign: { id: number; code: string; name: string; end_date: string }
  team: { id: number; name: string }
  brand: { id: number; name: string }
  priority: PriorityRef | null
  message: string | null
}

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

// Campaigns
export const fetchCampaigns = (params?: ListParams) =>
  client.get<{ data: Campaign[]; meta: { total: number } }>('/campaigns', { params })
    .then((response): Page<Campaign> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchCampaign = (id: number) => one<Campaign>(client.get(`/campaigns/${id}`))
export const createCampaign = (payload: CampaignPayload) => one<Campaign>(client.post('/campaigns', payload))
export const updateCampaign = (id: number, payload: CampaignPayload) => one<Campaign>(client.put(`/campaigns/${id}`, payload))
export const deleteCampaign = (id: number) => client.delete(`/campaigns/${id}`)

// The promo grid
export const fetchCampaignGrid = (id: number) => one<CampaignGrid>(client.get(`/campaigns/${id}/grid`))
export const createTick = (payload: { campaign_id: number; team_id: number; brand_id: number; speciality_id: number; priority_id?: number | null; message?: string | null }) =>
  one<CampaignTick>(client.post('/campaign-assignments', payload))
export const updateTick = (id: number, payload: { priority_id: number | null; message: string | null }) => one<CampaignTick>(client.put(`/campaign-assignments/${id}`, payload))
export const deleteTick = (id: number) => client.delete(`/campaign-assignments/${id}`)
export const checkAllForTeam = (id: number, teamId: number) => one<CampaignGrid>(client.post(`/campaigns/${id}/grid/check-all`, { team_id: teamId }))
export const previewCopy = (id: number, fromId: number) =>
  one<CopyPreview>(client.get(`/campaigns/${id}/grid/copy`, { params: { from_campaign_id: fromId } }))
export const copyGrid = (id: number, fromId: number) =>
  one<CampaignGrid & { copied: number }>(client.post(`/campaigns/${id}/grid/copy`, { from_campaign_id: fromId }))

// Settings ("⚙ Réglages")
export const fetchCampaignSettings = () => one<CampaignSettingsRead>(client.get('/campaign-settings'))
export const saveCampaignSettings = (payload: CampaignSettings & { material_period?: string; material_leftover?: string }) => one<CampaignSettingsRead>(client.put('/campaign-settings', payload))

// What a visit shows
export const fetchPromoLines = (params: { user_id: number; date: string; hcp_id: number }) =>
  client.get<{ data: PromoLine[] }>('/visits/promo-grid', { params }).then((response) => response.data.data)
