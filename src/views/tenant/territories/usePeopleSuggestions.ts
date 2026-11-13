import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchPeopleSuggestions, type CoverBlockPayload, type PersonSuggestion } from '@/api/tenant/territories'
import { watchDebounced } from './watchDebounced'

/**
 * Who is suggested to work a territory with these picks: home commune in its places, team with no
 * speciality or a picked one (docs/api/territories.md). Only a suggestion — anyone can be picked.
 * `covers` returning null skips the call (e.g. while the assign form is closed).
 */
export function usePeopleSuggestions(covers: () => CoverBlockPayload[] | null) {
  const { t } = useI18n()
  const byId = ref(new Map<number, PersonSuggestion>())
  const loaded = ref(false)
  watchDebounced(() => JSON.stringify(covers()), async () => {
    const picks = covers()
    if (!picks) return
    try {
      const rows = await fetchPeopleSuggestions(picks)
      byId.value = new Map(rows.map(row => [row.id, row]))
    }
    catch {
      byId.value = new Map()
    }
    finally {
      loaded.value = true
    }
  })

  /** Unknown people count as suggested, so nobody disappears when the call fails. */
  const isSuggested = (id: number) => byId.value.get(id)?.suggested ?? true
  /** The amber note on someone picked who isn't suggested. */
  const note = (id: number) => {
    const row = byId.value.get(id)
    if (!row || row.suggested) return ''
    return row.no_home ? t('territories.people.noHome') : t('territories.people.outside', { what: row.outside.join(' · ') })
  }
  /** "Kouba, Alger · Team Cardio". */
  const where = (id: number) => {
    const row = byId.value.get(id)
    return row ? [row.home, row.teams.join(', ')].filter(Boolean).join(' · ') : ''
  }

  return { byId, loaded, isSuggested, note, where }
}
