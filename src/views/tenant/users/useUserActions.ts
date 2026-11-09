import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { resetUserSecondFactor, sendUserAccessLink, updateUser, type TenantUser } from '@/api/tenant/users'
import type { DlMenuItem } from '@/components/DlMenu.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { accountStatus } from './userDisplay'

/**
 * What can be done to a person as a whole: access link, second-factor reset, deactivate / reactivate (no delete).
 * Shared by the side panel's ⋯ menu and the full page. `onChange` runs after each success.
 */
export function useUserActions(user: Ref<TenantUser | null>, options: { onChange: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const { confirm } = useConfirm()
  const auth = useAuthStore()
  const busy = ref(false)

  async function run(action: () => Promise<unknown>, success: string) {
    busy.value = true
    try {
      await action()
      toast.success(success)
      options.onChange()
      return true
    }
    catch (error) {
      // The API's reason (deactivated account, plan limit…), else a general message.
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return false
    }
    finally {
      busy.value = false
    }
  }

  const sendAccess = (person: TenantUser) =>
    run(() => sendUserAccessLink(person.id), t('users.actions.accessSent', { email: person.email }))

  async function resetSecondFactor(person: TenantUser) {
    const ok = await confirm({
      title: t('users.access.resetTitle', { name: person.full_name }),
      text: t('users.access.resetText'),
      confirmButtonText: t('users.access.reset'),
      icon: 'warning',
    })
    if (!ok) return false
    return run(() => resetUserSecondFactor(person.id), t('users.access.resetDone'))
  }

  async function setActive(person: TenantUser, active: boolean) {
    if (!active) {
      const ok = await confirm({
        title: t('users.actions.deactivateTitle', { name: person.full_name }),
        text: t('users.actions.deactivateText'),
        confirmButtonText: t('users.actions.deactivate'),
        icon: 'warning',
      })
      if (!ok) return false
    }
    return run(() => updateUser(person.id, { is_active: active }), t(active ? 'users.actions.reactivated' : 'users.actions.deactivated'))
  }

  /** ⋯ menu for the current person, by status and permission. */
  const menuItems = computed<DlMenuItem[]>(() => {
    const person = user.value
    if (!person) return []
    const status = accountStatus(person)
    const items: DlMenuItem[] = []
    if (auth.can('users.send-access') && status !== 'inactive')
      items.push({ label: t(status === 'invited' ? 'users.actions.resendAccess' : 'users.actions.sendAccess'), icon: 'tabler-mail-forward', onSelect: () => sendAccess(person) })
    if (auth.can('users.update') && person.id !== auth.user?.id) {
      items.push(status === 'inactive'
        ? { label: t('users.actions.reactivate'), icon: 'tabler-user-check', onSelect: () => setActive(person, true) }
        : { label: t('users.actions.deactivate'), icon: 'tabler-user-off', onSelect: () => setActive(person, false) })
    }
    return items
  })

  return { busy, sendAccess, resetSecondFactor, setActive, menuItems }
}
