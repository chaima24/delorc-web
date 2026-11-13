import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { deleteTerritory, type Territory } from '@/api/tenant/territories'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useTerritories } from './useTerritoryLookups'

/** Delete after confirming; the API refuses (422, with its reason) while territories sit under it or someone works it. */
export function useTerritoryDelete() {
  const { t } = useI18n()
  const toast = useToast()
  const { confirm } = useConfirm()
  const shared = useTerritories()

  async function remove(territory: Territory): Promise<boolean> {
    const ok = await confirm({
      title: t('studio.list.delete.title', { name: territory.name }),
      text: t('territories.delete.text'),
      confirmButtonText: t('common.actions.delete'),
      icon: 'warning',
    })
    if (!ok) return false
    try {
      await deleteTerritory(territory.id)
      toast.success(t('studio.list.toast.deleted'))
      if (shared.loaded.value) shared.refresh()
      return true
    }
    catch (error) {
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return false
    }
  }

  return { remove }
}
