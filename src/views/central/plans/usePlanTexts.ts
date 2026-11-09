import { useI18n } from 'vue-i18n'
import type { Plan } from '@/api/central/plans'

/** Feature names come from the central texts (features.<key>), prices are shown in each plan's own currency. */
export function usePlanTexts() {
  const { t, te, locale } = useI18n()

  const featureName = (key: string) => (te(`features.${key}.name`) ? t(`features.${key}.name`) : key)
  const featureDescription = (key: string) => (te(`features.${key}.description`) ? t(`features.${key}.description`) : '')

  function price(plan: Pick<Plan, 'monthly_price' | 'currency'>): string {
    const amount = Number(plan.monthly_price)

    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: plan.currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount)
  }

  return { featureName, featureDescription, price }
}
