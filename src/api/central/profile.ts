import { client } from '@/api/client'
import type { Session, User } from '@/api/auth'

export interface ProfileChanges {
  name?: string
  email?: string
  phone?: string | null
  locale?: string
}

/** The signed-in person changing their own account (delorc-api/docs/api/profile.md). */
export const profileApi = {
  update: (changes: ProfileChanges) => client.put<{ data: User }>('/profile', changes).then((response) => response.data.data),

  resendEmail: () => client.post<{ data: User }>('/profile/email/resend').then((response) => response.data.data),

  cancelEmail: () => client.delete('/profile/email'),

  /** Opened from the link sent to a new address: no session needed. */
  confirmEmail: (token: string) => client.post<{ message: string }>('/auth/email/confirm', { token }).then((response) => response.data),

  /** Answers a new session for this device: the other devices are signed out. */
  changePassword: (currentPassword: string, password: string, passwordConfirmation: string) =>
    client
      .put<Session>('/profile/password', { current_password: currentPassword, password, password_confirmation: passwordConfirmation })
      .then((response) => response.data),
}
