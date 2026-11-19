import { ref, watch, type Ref } from 'vue'
import { fieldErrors } from '@/api/errors'
import { previewOrder, type OrderPayload, type OrderPreview } from '@/api/tenant/orders'

/**
 * Live totals: the API computes the order while it is typed (POST orders/preview, nothing saved), a moment after the
 * last change. Like asking the server for a quote before placing the order.
 */
export function useOrderPreview(payload: Ref<(OrderPayload & { id?: number }) | null>) {
  const preview = ref<OrderPreview | null>(null)
  const errors = ref<Record<string, string>>({})
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let asked = 0

  watch(payload, value => {
    clearTimeout(timer)
    if (!value) {
      preview.value = null
      return
    }
    timer = setTimeout(async () => {
      const mine = ++asked
      loading.value = true
      try {
        const answer = await previewOrder(value)
        if (mine !== asked) return
        preview.value = answer
        errors.value = {}
      }
      catch (error) {
        if (mine === asked) errors.value = fieldErrors(error)
      }
      finally {
        if (mine === asked) loading.value = false
      }
    }, 400)
  }, { deep: true, immediate: true })

  return { preview, errors, loading }
}
