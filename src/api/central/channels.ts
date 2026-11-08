import { client } from '@/api/client'

export type Encryption = 'tls' | 'ssl' | 'none'

/** An SMTP account as the API shows it: never the password, only whether one is saved. */
export interface MailServer {
  host: string | null
  port: number | null
  encryption: Encryption | null
  username: string | null
  password_set: boolean
  from_address: string | null
}

/** Delorc's shared account, on Central › Settings. */
export interface SharedMail extends MailServer {
  is_set: boolean
}

/** What a save sends. An empty password keeps the saved one. */
export interface MailServerFields {
  host: string
  port: number | null
  encryption: Encryption
  username: string | null
  password: string
  from_address: string
}

/** A lab's email on its Channels tab. No row in the API means shared. */
export interface LabEmail {
  mode: 'shared' | 'own'
  /** What people receive. `address` is null while Delorc's account is not set. */
  from: { name: string; address: string | null }
  reply_to: string | null
  own: (MailServer & { from_name: string }) | null
  last_error: string | null
  last_error_at: string | null
  /** This month; a null quota is unlimited. */
  usage: { month: string; sent: number; quota: number | null }
}

export type LabEmailFields = { mode: 'shared' } | ({ mode: 'own'; from_name: string } & MailServerFields)

/** A test uses the saved values. A failure answers 422 with a reason. */
export interface TestResult { sent: true; at: string }

export const channelsApi = {
  shared: () => client.get<{ data: SharedMail }>('/settings/mail').then((response) => response.data.data),
  saveShared: (fields: MailServerFields) => client.put<{ data: SharedMail }>('/settings/mail', fields).then((response) => response.data.data),
  testShared: (to: string) => client.post<TestResult>('/settings/mail/test', { to }).then((response) => response.data),
  lab: (labId: string) => client.get<{ data: { email: LabEmail } }>(`/labs/${labId}/channels`).then((response) => response.data.data.email),
  saveLabEmail: (labId: string, fields: LabEmailFields) => client.put<{ data: { email: LabEmail } }>(`/labs/${labId}/channels/email`, fields)
    .then((response) => response.data.data.email),
  testLabEmail: (labId: string, to: string) => client.post<TestResult>(`/labs/${labId}/channels/email/test`, { to }).then((response) => response.data),
}
