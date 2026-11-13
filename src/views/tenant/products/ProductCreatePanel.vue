<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createProduct, type Product } from '@/api/tenant/products'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSteps from '@/components/DlSteps.vue'
import { useToast } from '@/composables/useToast'
import ProductFields from './ProductFields.vue'
import ProductThumb from './ProductThumb.vue'
import { checkPart, toForm, toPayload } from './productForm'

// "Add a product" in 2 steps: product (photo, name, brand…) · prices and orders.
// `from` pre-fills the form (Duplicate).
const props = defineProps<{ from?: Product | null }>()
const emit = defineEmits<{ created: [product: Product] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const form = ref(toForm())
const photo = ref<File | null>(null)
const step = ref(0)
const errors = ref<Record<string, string>>({})
const saving = ref(false)

watch(open, value => {
  if (!value) return
  form.value = toForm(props.from)
  if (props.from) form.value.name = t('products.duplicate.name', { name: props.from.name })
  photo.value = null
  step.value = 0
  errors.value = {}
}, { immediate: true })

const photoUrl = computed(() => (photo.value ? URL.createObjectURL(photo.value) : null))
function pickPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) photo.value = file
}

const steps = computed(() => [t('products.add.steps.product'), t('products.add.steps.prices')])
const INFO_FIELDS = ['name', 'brand_id', 'therapeutic_area', 'per_box', 'description', 'photo']

function next() {
  errors.value = checkPart(form.value, 'info', t('users.add.required'))
  if (!Object.keys(errors.value).length) step.value = 1
}

async function save() {
  errors.value = checkPart(form.value, 'info', t('users.add.required'))
  if (Object.keys(errors.value).length) {
    step.value = 0
    return
  }
  saving.value = true
  try {
    const product = await createProduct(toPayload(form.value), photo.value)
    toast.success(t('products.add.done', { name: form.value.name.trim() }))
    emit('created', product)
  }
  catch (error) {
    const found = fieldErrors(error)
    if (!Object.keys(found).length) {
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return
    }
    errors.value = Object.fromEntries(Object.entries(found).map(([key, message]) => [key.split('.')[0]!, message]))
    if (INFO_FIELDS.some(key => errors.value[key])) step.value = 0
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t(from ? 'products.duplicate.title' : 'products.add.title')" :description="t('teams.add.step', { n: step + 1, total: 2, name: steps[step] })">
    <form id="product-create" class="flex flex-col gap-4" @submit.prevent="step === 0 ? next() : save()">
      <DlSteps :steps="steps" :current="step" />

      <template v-if="step === 0">
        <div class="flex items-center gap-3">
          <ProductThumb :src="photoUrl" size="lg" />
          <label class="cursor-pointer text-[13px] font-semibold text-dl-cobalt hover:underline">
            {{ t(photo ? 'products.photo.change' : 'products.photo.addOptional') }}
            <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="pickPhoto">
          </label>
          <span v-if="errors.photo" class="text-xs text-dl-rejected">{{ errors.photo }}</span>
        </div>
        <ProductFields v-model:form="form" part="info" :errors="errors" />
      </template>

      <template v-else>
        <ProductFields v-model:form="form" part="prices" :errors="errors" />
        <ProductFields v-model:form="form" part="orders" :errors="errors" />
      </template>
    </form>

    <template #footer>
      <DlButton v-if="step === 0" variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton v-else variant="ghost" @click="step = 0">{{ t('users.add.back') }}</DlButton>
      <DlButton v-if="step === 0" type="submit" form="product-create" variant="dark" class="ms-auto">{{ t('users.add.next') }}</DlButton>
      <DlButton v-else type="submit" form="product-create" variant="primary" class="ms-auto" :loading="saving">{{ t('products.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
