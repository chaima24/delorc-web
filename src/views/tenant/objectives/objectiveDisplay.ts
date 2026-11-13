import { useI18n } from 'vue-i18n'
import type { Objective, ObjectiveNumber, ObjectiveNumbers } from '@/api/tenant/objectives'
import { OBJECTIVE_NUMBERS } from '@/api/tenant/objectives'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { today } from '@/views/tenant/users/userDisplay'

/** The kinds of professionals behind each visit number (Studio › Roles › Visits). */
const KINDS: Partial<Record<ObjectiveNumber, string[]>> = {
  doctor: ['doctor', 'dentiste'],
  business: ['pharmacie'],
  wholesaler: ['wholestore', 'distributor'],
}

/**
 * The numbers asked for a role: the visit numbers of the kinds it visits, then orders and
 * coaching visits (always). A number the role doesn't visit stays 0.
 */
export function numbersFor(visits: string[] = []): ObjectiveNumber[] {
  return OBJECTIVE_NUMBERS.filter(number => !KINDS[number] || KINDS[number]!.some(kind => visits.includes(kind)))
}

export const emptyNumbers = (): ObjectiveNumbers => ({ doctor: 0, business: 0, wholesaler: 0, commande: 0, coaching: 0 })

export function numbersOf(objective: Objective): ObjectiveNumbers {
  return Object.fromEntries(OBJECTIVE_NUMBERS.map(number => [number, objective[number] ?? 0])) as ObjectiveNumbers
}

/** current: running today · upcoming: starts later · ended. */
export function objectiveState(objective: Pick<Objective, 'start_date' | 'end_date'>): 'current' | 'upcoming' | 'ended' {
  const now = today()
  if (objective.start_date.slice(0, 10) > now) return 'upcoming'
  return objective.end_date && objective.end_date.slice(0, 10) < now ? 'ended' : 'current'
}

/** The day after a date (ISO). */
export function dayAfter(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

/** First day of next month (ISO): the usual date a change starts from. */
export function nextMonthStart(): string {
  const date = new Date()
  return new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 1)).toISOString().slice(0, 10)
}

export function useObjectiveText() {
  const { t } = useI18n()

  return {
    /** "VM · Cardio", "VM · All teams". */
    name: (objective: Pick<Objective, 'role' | 'team'>) => `${roleLabel(objective.role?.name)} · ${objective.team?.name ?? t('objectives.allTeams')}`,
    team: (objective: Pick<Objective, 'team'>) => objective.team?.name ?? t('objectives.allTeams'),
    number: (number: ObjectiveNumber) => t(`objectives.numbers.${number}`),
  }
}
