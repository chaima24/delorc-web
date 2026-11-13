import { useI18n } from 'vue-i18n'
import type { Adv, AdvAudience, AdvType } from '@/api/tenant/advs'

/** What each type accepts in the file picker (the API checks again). Only a gallery takes several files. */
export const ADV_ACCEPT: Record<AdvType, string> = {
  pdf: '.pdf',
  video: '.mp4,.mov,.webm,.avi,.mkv',
  galerie: '.jpg,.jpeg,.png',
  html5: '.zip',
}
export const COVER_ACCEPT = '.jpg,.jpeg,.png'

export const GB = 1024 ** 3

export function useAdvText() {
  const { t, n, d } = useI18n()
  const date = (iso?: string | null) => (iso ? d(new Date(`${iso.slice(0, 10)}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  return {
    type: (type: AdvType) => t(`advs.type.${type}`),
    date,
    /** "412 Ko", "6,2 Mo", "1,4 Go". */
    size(bytes?: number | null) {
      const value = bytes ?? 0
      if (value >= GB) return t('advs.size.gb', { n: n(value / GB, { maximumFractionDigits: 1 }) })
      if (value >= 1024 ** 2) return t('advs.size.mb', { n: n(value / 1024 ** 2, { maximumFractionDigits: 1 }) })
      return t('advs.size.kb', { n: n(Math.max(1, Math.round(value / 1024))) })
    },
    /** "Neuro · depuis le 12 oct. 2026", "Cardio Est · jusqu'au 31 mars 2027". */
    audience(row: AdvAudience) {
      if (row.start_date && row.end_date) return t('advs.audience.between', { name: row.name, from: date(row.start_date), to: date(row.end_date) })
      if (row.start_date) return t('advs.audience.from', { name: row.name, date: date(row.start_date) })
      if (row.end_date) return t('advs.audience.until', { name: row.name, date: date(row.end_date) })
      return row.name
    },
    /** "8 images", "1 fichier". */
    content: (adv: Pick<Adv, 'type' | 'slides_count'>) => t(adv.type === 'galerie' ? 'advs.content.images' : 'advs.content.files', { n: n(adv.slides_count) }, adv.slides_count),
  }
}
