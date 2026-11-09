import { client } from '@/api/client'

export interface User {
  id: number
  name: string
  initials: string
  email: string
  /** A new email waiting for the link sent to it. */
  pending_email: string | null
  phone: string | null
  locale: string
  is_active: boolean
  last_login_at: string | null
  role: string | null
  /** Owner or admin: may do everything, and `permissions` stays empty. */
  is_super: boolean
  permissions: string[]
  /** `required`: everyone must have one, so it cannot be turned off (switching method is allowed). */
  two_factor: { method: 'none' | 'app' | 'email' | 'sms'; confirmed: boolean; recovery_codes_left: number; required: boolean }
}

export interface Session {
  status: 'ok'
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
  two_factor_setup_required: boolean
  user: User
}

export interface TwoFactorChallenge {
  status: 'two_factor_required'
  method: 'app' | 'email' | 'sms'
  challenge: string
  expires_in: number
}

export const authApi = {
  login: (email: string, password: string) =>
    client.post<Session | TwoFactorChallenge>('/auth/login', { email, password }).then((response) => response.data),

  verifyTwoFactor: (challenge: string, code: string) =>
    client.post<Session>('/auth/two-factor/verify', { challenge, code }).then((response) => response.data),

  resendCode: (challenge: string) => client.post<{ message: string }>('/auth/two-factor/send', { challenge }),

  forgotPassword: (email: string) => client.post('/auth/password/forgot', { email }),

  setPassword: (token: string, password: string, passwordConfirmation: string) =>
    client
      .post<Session>('/auth/password/set', { token, password, password_confirmation: passwordConfirmation })
      .then((response) => response.data),

  me: () => client.get<{ data: User }>('/auth/me').then((response) => response.data.data),

  logout: (refreshToken: string | null) => client.post('/auth/logout', { refresh_token: refreshToken }),

  /** Step 1 of the authenticator app: a secret and its QR code. Nothing changes until it is confirmed. */
  setupApp: () => client.post<{ secret: string; otpauth_url: string; qr_svg: string }>('/auth/two-factor/app/setup').then((response) => response.data),

  /** Step 2: the first code from the app turns it on, and gives the recovery codes once. */
  confirmApp: (code: string) =>
    client.post<{ recovery_codes: string[]; user: User }>('/auth/two-factor/app/confirm', { code }).then((response) => response.data),

  useEmailCode: (password: string) =>
    client.put<{ data: User }>('/auth/two-factor/method', { method: 'email', password }).then((response) => response.data.data),

  disableTwoFactor: (password: string) =>
    client.post<{ data: User }>('/auth/two-factor/disable', { password }).then((response) => response.data.data),

  newRecoveryCodes: (password: string) =>
    client.post<{ recovery_codes: string[] }>('/auth/two-factor/recovery-codes', { password }).then((response) => response.data.recovery_codes),
}
