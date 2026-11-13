import { shallowRef } from 'vue'

/** A yes/no question shown by `DlConfirmHost` (mounted once in App.vue). `confirm()` waits for the answer. */
export type ConfirmIcon = 'warning' | 'error' | 'success' | 'info' | 'question'
export type ConfirmResult = 'confirm' | 'cancel'

export interface ConfirmRequest {
  title?: string
  text?: string
  icon: ConfirmIcon
  confirmButtonText?: string
  cancelButtonText?: string | null
  resolve: (result: ConfirmResult) => void
}

/** The question on screen; at most one at a time. */
export const activeConfirm = shallowRef<ConfirmRequest | null>(null)

/** Called by the host when the person answers. */
export function settleConfirm(result: ConfirmResult): void {
  activeConfirm.value?.resolve(result)
  activeConfirm.value = null
}

export function useConfirm() {
  function confirm(options: Omit<ConfirmRequest, 'resolve' | 'icon'> & { icon?: ConfirmIcon }): Promise<boolean> {
    return new Promise((resolve) => {
      activeConfirm.value = { ...options, icon: options.icon ?? 'question', resolve: (result) => resolve(result === 'confirm') }
    })
  }

  return { confirm }
}
