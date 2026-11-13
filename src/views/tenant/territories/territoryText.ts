import { useI18n } from 'vue-i18n'
import type { Territory, TerritoryPersonRef, TerritoryStint, ZoneType } from '@/api/tenant/territories'
import { useUserText } from '@/views/tenant/users/userDisplay'

export const personName = (person?: TerritoryPersonRef | null) => person?.full_name || '—'

/** Words for territories: what one covers, who works it, residence levels. */
export function useTerritoryText() {
  const { t, n } = useI18n()
  const userText = useUserText()

  /** "Alger, Blida, Tipaza +2". */
  const list = (names: string[], max = 3) => {
    if (!names.length) return t('territories.covers.nothing')
    return names.length > max ? `${names.slice(0, max).join(', ')} ${t('territories.covers.more', { n: n(names.length - max) })}` : names.join(', ')
  }
  /** The picked items' names. */
  const places = (territory: Territory, max = 3) => list((territory.covers ?? []).flatMap(cover => cover.items.map(item => item.name ?? '')), max)

  /** "Wilaya 1 · Commune 9": how many items of each rule type. */
  const counts = (territory: Territory) =>
    (territory.covers ?? []).map(cover => `${cover.name} ${n(cover.items.length)}`).join(' · ')

  /** "Part of Centre" / "Top level" (+ "3 under it"). */
  const position = (territory: Territory) => {
    const where = territory.parent ? t('territories.position.in', { name: territory.parent.name }) : t('territories.position.top')
    const under = territory.children_count ? ` · ${t('territories.position.under', { n: n(territory.children_count) }, territory.children_count)}` : ''
    return where + under
  }

  const zone = (type: ZoneType) => t(`ruleTypes.zoneTypes.${type}`)

  /** "since 3 Mar 2025" / "3 Mar 2025 → 2 Mar 2026" / "from 3 Nov 2026". */
  const stint = (row: TerritoryStint) => {
    if (row.start_date > new Date().toISOString().slice(0, 10)) return t('territories.people.from', { date: userText.date(row.start_date) })
    if (!row.end_date) return t('territories.people.since', { date: userText.date(row.start_date) })
    return t('users.history.period', { from: userText.date(row.start_date), to: userText.date(row.end_date) })
  }

  return { list, places, counts, position, zone, stint, date: userText.date }
}

/** Colour of a residence level chip. */
export const ZONE_TONES: Record<ZoneType, string> = {
  RE: 'bg-dl-teal/10 text-dl-teal',
  SR: 'bg-dl-cobalt/10 text-dl-cobalt',
  HR: 'bg-dl-pending/10 text-dl-pending',
}
