<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAllBrands } from '@/api/tenant/brands'
import { fetchTherapeuticAreas } from '@/api/tenant/products'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import { PRICE_FIELDS, type ProductForm, type ProductPart } from './productForm'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

// The fields of one part of a product: info · prices · orders (strategic, pack discount, UG).
defineProps<{
  part: ProductPart
  errors?: Record<string, string>
}>()
const form = defineModel<ProductForm>('form', { required: true })
const { t } = useI18n()
const id = useId()

const brands = ref<{ id: number; name: string }[]>([])
const brandOptions = computed(() => brands.value.map(brand => ({ value: brand.id, label: brand.name })).sort((a, b) => a.label.localeCompare(b.label)))

// Areas already used, offered while typing (a new one can still be typed).
const areas = ref<string[]>([])
onMountedAndFocus(async () => {
  brands.value = await fetchAllBrands()
  try {
    areas.value = await fetchTherapeuticAreas()
  }
  catch {
    // Suggestions only.
  }
})

const brandModel = computed({
  get: () => form.value.brand_id,
  set: value => { form.value.brand_id = value == null ? null : Number(value) },
})

// Free units (UG): whole numbers, no duplicates, kept sorted.
const newUg = ref<string | number | null>('')
const ugError = ref('')
function addUg() {
  const typed = String(newUg.value ?? '').trim()
  const value = Number(typed)
  if (typed === '' || !Number.isInteger(value) || value < 0) {
    ugError.value = t('products.ug.invalid')
    return
  }
  ugError.value = ''
  if (!form.value.ugs.includes(value)) form.value.ugs = [...form.value.ugs, value].sort((a, b) => a - b)
  newUg.value = ''
}
function removeUg(value: number) {
  form.value.ugs = form.value.ugs.filter(ug => ug !== value)
}
</script>

<template>
  <div v-if="part === 'info'" class="flex flex-col gap-3.5">
    <DlInput v-model="form.name" :label="t('products.fields.name')" :error="errors?.name" />
    <DlCombobox v-model="brandModel" :label="t('products.fields.brand')" :options="brandOptions" :error="errors?.brand_id" />
    <DlInput v-model="form.therapeutic_area" :label="t('products.fields.area')" :list="`${id}-areas`" :error="errors?.therapeutic_area" />
    <DlInput v-model="form.per_box" type="number" min="0" step="1" :label="t('products.fields.perBox')" :error="errors?.per_box" />
    <datalist :id="`${id}-areas`">
      <option v-for="area in areas" :key="area" :value="area" />
    </datalist>
    <label class="flex flex-col gap-1.5">
      <span class="text-[13px] font-semibold">{{ t('products.fields.descriptionOptional') }}</span>
      <textarea
        v-model="form.description"
        rows="3"
        :placeholder="t('products.fields.descriptionPlaceholder')"
        class="rounded-xl border border-dl-line bg-dl-paper px-3.5 py-2.5 text-sm outline-hidden placeholder:text-dl-muted focus:ring-2 focus:ring-dl-cobalt"
      />
    </label>
  </div>

  <div v-else-if="part === 'prices'" class="flex flex-col gap-3.5">
    <DlInput v-model="form.price" type="number" min="0" step="0.01" :label="t('products.fields.price')" :hint="t('products.fields.priceHint')" :error="errors?.price" />
    <DlInput v-model="form.vat" type="number" min="0" step="0.01" :label="t('products.fields.vat')" :error="errors?.vat" />
    <DlInput v-for="key in PRICE_FIELDS" :key="key" v-model="form[key]" type="number" min="0" step="0.01" :label="t(`products.fields.${key}`)" :error="errors?.[key]" />
  </div>

  <div v-else class="flex flex-col gap-3">
    <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-dl-line px-3.5 py-2.5 hover:bg-dl-mist">
      <input v-model="form.strategic" type="checkbox" class="mt-0.5 h-[18px] w-[18px] shrink-0 accent-dl-ink">
      <span class="flex flex-col"><strong class="text-sm font-semibold">{{ t('products.fields.strategic') }}</strong><span class="text-xs text-dl-muted">{{ t('products.fields.strategicHint') }}</span></span>
    </label>
    <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-dl-line px-3.5 py-2.5 hover:bg-dl-mist">
      <input v-model="form.us_discountable" type="checkbox" class="mt-0.5 h-[18px] w-[18px] shrink-0 accent-dl-ink">
      <span class="flex flex-col"><strong class="text-sm font-semibold">{{ t('products.fields.discountable') }}</strong><span class="text-xs text-dl-muted">{{ t('products.fields.discountableHint') }}</span></span>
    </label>
    <fieldset class="flex min-w-0 flex-col gap-2">
      <legend class="mb-1 text-[13px] font-semibold">{{ t('products.fields.ugs') }}</legend>
      <ul v-if="form.ugs.length" class="flex flex-wrap gap-1.5">
        <li v-for="ug in form.ugs" :key="ug" class="flex items-center gap-1 rounded-full bg-dl-line-soft py-1 ps-2.5 pe-1 text-xs font-semibold">
          {{ ug }}
          <button type="button" class="flex h-5 w-5 items-center justify-center rounded-full hover:bg-dl-line" :aria-label="t('products.ug.remove', { value: ug })" @click="removeUg(ug)">
            <DlIcon icon="tabler-x" :size="12" />
          </button>
        </li>
      </ul>
      <DlInput
        v-model="newUg"
        type="number"
        min="0"
        step="1"
        :label="t('products.ug.add')"
        :placeholder="t('products.ug.placeholder')"
        hide-label
        :error="ugError || errors?.ugs"
        @keydown.enter.prevent="addUg"
      >
        <template #end>
          <button type="button" class="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-dl-cobalt hover:underline" @click="addUg">
            <DlIcon icon="tabler-plus" :size="15" />{{ t('products.ug.addButton') }}
          </button>
        </template>
      </DlInput>
      <p class="text-xs text-dl-muted">{{ t('products.ug.hint') }}</p>
    </fieldset>
  </div>
</template>
