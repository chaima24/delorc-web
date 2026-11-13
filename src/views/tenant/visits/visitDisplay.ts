import { useI18n } from 'vue-i18n'
import type { Visit, VisitShort } from '@/api/tenant/visits'

type Tone = 'neutral' | 'info' | 'success' | 'warning'

/** The state a visit shows: its stored status, or "late" for a planned visit whose day has passed. */
export const visitState = (visit: Pick<Visit, 'status' | 'late'>) => (visit.late ? 'late' : visit.status)
export const VISIT_TONES: Record<string, Tone> = { planned: 'info', done: 'success', late: 'warning', cancelled: 'neutral' }

/** Today as the API writes days (local, not UTC). */
export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function useVisitText() {
  const { t, d } = useI18n()
  const at = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`)
  return {
    state: (visit: Pick<Visit, 'status' | 'late'>) => t(`visits.state.${visitState(visit)}`),
    tone: (visit: Pick<Visit, 'status' | 'late'>) => VISIT_TONES[visitState(visit)] ?? 'neutral',
    /** "jeu. 12 nov." */
    day: (iso?: string | null) => (iso ? d(at(iso), { weekday: 'short', day: 'numeric', month: 'short' }) : ''),
    /** "jeudi 12 novembre 2026" */
    dayLong: (iso?: string | null) => (iso ? d(at(iso), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''),
    /** "12 nov. 2026" */
    date: (iso?: string | null) => (iso ? d(at(iso), { day: 'numeric', month: 'short', year: 'numeric' }) : ''),
    /** "Cardiologie · El Biar" */
    where: (target: Visit['target']) => [target.speciality, target.commune].filter(Boolean).join(' · '),
    /** "Cardiozen 4 · Tensio 3" */
    brands: (visit: Pick<VisitShort, 'brands'>) => visit.brands.map(brand => (brand.feedback ? `${brand.name} ${brand.feedback}` : brand.name)).join(' · '),
    /** Two letters for the avatar tile. */
    initials: (name?: string | null) => (name ?? '').replace(/^Dr\.? /i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]!.toUpperCase()).join(''),
  }
}
