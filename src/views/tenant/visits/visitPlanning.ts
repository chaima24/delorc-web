import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import type { VisitPayload } from '@/api/tenant/visits'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

const pad = (value: number) => String(value).padStart(2, '0')
/** A local day as the API writes it. */
export const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const dateOf = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`)
export function addDays(iso: string, days: number): string {
  const date = dateOf(iso)
  date.setDate(date.getDate() + days)
  return isoOf(date)
}
/** The Sunday that starts the week of a day. */
export const weekStart = (iso: string) => addDays(iso, -dateOf(iso).getDay())

/**
 * Saves a planned visit and handles what planning answers (docs/api/visit-planning.md): a weekend day asks to
 * confirm and is sent again with `confirm_weekend`; a refusal (holiday, day off, maximum, plan closed, entry delay)
 * shows its sentence. Used by the calendar's drops and by the add page.
 */
export function usePlanningSave() {
  const { t } = useI18n()
  const toast = useToast()
  const { confirm } = useConfirm()

  /** @returns the saved record, or null when it was refused or the person said no. */
  async function save<T>(send: (payload: VisitPayload) => Promise<T>, payload: VisitPayload, onError?: (error: unknown) => boolean): Promise<T | null> {
    try {
      return await send(payload)
    }
    catch (error) {
      const answer = axios.isAxiosError(error) ? error.response?.data : null
      if (answer?.confirm === 'weekend') {
        const ok = await confirm({ title: t('visits.planning.weekendTitle'), text: answer.message, confirmButtonText: t('visits.planning.weekendYes'), icon: 'warning' })
        return ok ? save(send, { ...payload, confirm_weekend: true }, onError) : null
      }
      if (!onError?.(error)) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return null
    }
  }

  return { save }
}
