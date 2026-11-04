import { client } from '@/api/client'

export interface User {
  id: number
  name: string
  initials: string
  email: string
  phone: string | null
  locale: string
  is_active: boolean
  last_login_at: string | null
  two_factor: { method: 'none' | 'app' | 'email' | 'sms'; confirmed: boolean; recovery_codes_left: number }
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

  resendCode: (challenge: string) => client.post('/auth/two-factor/send', { challenge }),

  forgotPassword: (email: string) => client.post('/auth/password/forgot', { email }),

  setPassword: (token: string, password: string, passwordConfirmation: string) =>
    client
      .post<Session>('/auth/password/set', { token, password, password_confirmation: passwordConfirmation })
      .then((response) => response.data),

  me: () => client.get<{ data: User }>('/auth/me').then((response) => response.data.data),

  logout: (refreshToken: string | null) => client.post('/auth/logout', { refresh_token: refreshToken }),
}
