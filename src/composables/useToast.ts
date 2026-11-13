import { shallowRef } from 'vue'

/** A short message after an action ("Saved"), shown by `DlToast` (mounted once in App.vue) for 4 seconds. */
export interface Toast {
  id: number
  tone: 'success' | 'error'
  text: string
}

export const toasts = shallowRef<Toast[]>([])
let next = 0

function show(tone: Toast['tone'], text: string): void {
  const toast = { id: ++next, tone, text }
  toasts.value = [...toasts.value, toast]
  setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== toast.id)
  }, 4000)
}

export function useToast() {
  return {
    success: (text: string) => show('success', text),
    error: (text: string) => show('error', text),
  }
}
