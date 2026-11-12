import { useI18n } from 'vue-i18n'
import type { Consent, ConsentState } from '@/api/tenant/consents'
import { useUserText } from '@/views/tenant/users/userDisplay'

export const STATE_TONES: Record<ConsentState, 'success' | 'danger' | 'warning' | 'neutral'> = {
  given: 'success',
  refused: 'danger',
  waiting: 'warning',
  inactive: 'neutral',
}

export function useConsentText() {
  const { t } = useI18n()
  const userText = useUserText()
  const person = (user?: Consent['requested_by']) => user?.full_name ?? null
  /** "24 Oct 2026 · Sara M." */
  const asked = (consent: Consent) => [userText.date(consent.created_at), person(consent.requested_by)].filter(Boolean).join(' · ')
  const state = (value: ConsentState) => t(`consents.states.${value}`)
  return { asked, state, person, dateTime: userText.dateTime, date: userText.date }
}
