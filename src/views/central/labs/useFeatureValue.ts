import { useI18n } from 'vue-i18n'
import type { FeatureValue } from '@/api/central/labs'

/** A feature's value in words, as on the Plans page: Unlimited, None, a number, Included, Not included. */
export function useFeatureValue() {
  const { t, n } = useI18n()

  function shown(type: 'limit' | 'switch', value: FeatureValue): string {
    if (type === 'switch') return t(value ? 'central.plans.included' : 'central.plans.notIncluded')
    if (value === null) return t('central.plans.unlimited')

    return value === 0 ? t('central.plans.none') : n(Number(value))
  }

  return { shown }
}
