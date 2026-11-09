<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { changeProductPhoto, deleteProduct, fetchProduct, removeProductPhoto, updateProduct, type Product } from '@/api/tenant/products'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import ProductFields from './ProductFields.vue'
import ProductThumb from './ProductThumb.vue'
import { PRICE_FIELDS, checkPart, toForm, toPayload, useProductText, type ProductPart } from './productForm'

// A product's full page: header with the key figures (the order counts join with orders), then the record (Product · Prices ·
// In orders, each with its own Edit) beside the photo. Mockup: docs/design/studio-mockups/ProductPage.html
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = computed(() => auth.can('products.update'))
const text = useProductText()

const product = ref<Product | null>(null)
const failed = ref(false)
async function load() {
  try {
    product.value = await fetchProduct(Number(props.id))
    failed.value = false
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => {
  product.value = null
  load()
}, { immediate: true })

const editing = reactive<Record<ProductPart, boolean>>({ info: false, prices: false, orders: false })
const form = ref(toForm())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(product, value => {
  form.value = toForm(value)
  errors.value = {}
})

async function save(part: ProductPart) {
  if (!product.value) return
  errors.value = checkPart(form.value, part, t('users.add.required'))
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    await updateProduct(product.value.id, toPayload(form.value, [part]))
    toast.success(t('studio.list.toast.saved'))
    editing[part] = false
    await load()
  }
  catch (error) {
    errors.value = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, message]) => [key.split('.')[0]!, message]))
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
function cancel(part: ProductPart) {
  editing[part] = false
  form.value = toForm(product.value)
  errors.value = {}
}

// Photo: changed or removed at once.
const photoBusy = ref(false)
async function pickPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !product.value) return
  photoBusy.value = true
  try {
    product.value = await changeProductPhoto(product.value.id, file)
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    photoBusy.value = false
  }
}
async function removePhoto() {
  if (!product.value) return
  photoBusy.value = true
  try {
    product.value = await removeProductPhoto(product.value.id)
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    photoBusy.value = false
  }
}

async function remove() {
  if (!product.value) return
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: product.value.name }),
    text: t('products.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteProduct(product.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-products' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

/** The key figures in the header ("ordered N times" and pack orders join with orders). */
const figures = computed(() => {
  const value = product.value
  if (!value) return []
  return [
    { label: t('products.fields.price'), value: text.money(value.price), note: t('products.page.perUnit') },
    { label: t('products.fields.vat'), value: text.percent(value.vat), note: t('products.page.onNetLine') },
  ]
})
const infoRows = computed(() => {
  const value = product.value
  if (!value) return []
  return [
    { label: t('products.fields.name'), value: value.name },
    { label: t('products.fields.brand'), value: value.brand?.name ?? '—' },
    { label: t('products.fields.area'), value: value.therapeutic_area || '—' },
    { label: t('products.fields.perBox'), value: value.per_box ?? '—' },
    { label: t('products.fields.description'), value: value.description || '—' },
  ]
})
const flags = computed(() => [
  { on: !!product.value?.strategic, label: t('products.fields.strategic'), hint: t('products.fields.strategicHint') },
  { on: !!product.value?.us_discountable, label: t('products.fields.discountable'), hint: t('products.fields.discountableHint') },
])
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.studio') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-products' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('products.title') }}</RouterLink>
      <template v-if="product">
        <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
        <span>{{ product.name }}</span>
      </template>
    </nav>

    <p v-if="failed" class="rounded-3xl bg-dl-paper p-5 text-sm text-dl-rejected">{{ t('products.page.notFound') }}</p>
    <div v-else-if="!product" class="flex flex-col gap-3" aria-hidden="true">
      <DlSkeleton class="h-28 rounded-3xl" />
      <DlSkeleton class="h-64 rounded-3xl" />
    </div>

    <template v-else>
      <header class="flex flex-col gap-5 rounded-3xl bg-dl-paper p-5 md:p-6">
        <div class="flex flex-wrap items-center gap-4 md:gap-5">
          <ProductThumb :src="product.photo?.url" size="lg" />
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <h1 class="font-display text-[24px] font-extrabold leading-tight tracking-[-0.03em] md:text-[30px]">{{ product.name }}</h1>
            <div class="flex flex-wrap items-center gap-1.5">
              <DlBadge v-if="product.brand" size="sm">{{ product.brand.name }}</DlBadge>
              <DlBadge v-if="product.therapeutic_area" size="sm">{{ product.therapeutic_area }}</DlBadge>
              <DlBadge v-if="product.strategic" size="sm" tone="signal" icon="tabler-check">{{ t('products.list.strategic') }}</DlBadge>
              <DlBadge v-if="product.us_discountable" size="sm" tone="signal" icon="tabler-check">{{ t('products.list.discountable') }}</DlBadge>
              <span class="text-xs text-dl-muted">· {{ t('products.page.added', { date: text.date(product.created_at) }) }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 max-sm:w-full">
            <DlButton v-if="auth.can('products.create')" variant="outline" icon="tabler-copy" class="max-sm:flex-1" :to="{ name: 'tenant-products', query: { duplicate: product.id } }">
              {{ t('products.duplicate.button') }}
            </DlButton>
            <DlButton v-if="auth.can('products.delete')" variant="danger" icon="tabler-trash" class="max-sm:flex-1" @click="remove">{{ t('common.actions.delete') }}</DlButton>
          </div>
        </div>

        <dl class="grid grid-cols-2 gap-2.5">
          <div v-for="figure in figures" :key="figure.label" class="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-dl-mist px-4 py-3">
            <dt class="text-xs text-dl-muted">{{ figure.label }}</dt>
            <dd class="truncate font-display text-[20px] font-extrabold tabular-nums md:text-[22px]">{{ figure.value }}</dd>
            <dd class="truncate text-[11.5px] text-dl-muted">{{ figure.note }}</dd>
          </div>
        </dl>
      </header>

      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div class="flex min-w-0 flex-col gap-4">
          <DlRecordSection
            v-model:editing="editing.info"
            :title="t('products.read.product')"
            icon="tabler-pill"
            :can-edit="canUpdate"
            :saving="saving"
            class="bg-dl-paper"
            @save="save('info')"
            @cancel="cancel('info')"
          >
            <dl class="divide-y divide-dl-line-soft">
              <div v-for="row in infoRows" :key="row.label" class="grid grid-cols-[110px_1fr] gap-3 py-2.5 first:pt-1 last:pb-0 md:grid-cols-[140px_1fr]">
                <dt class="text-dl-muted">{{ row.label }}</dt><dd class="whitespace-pre-line text-dl-fg">{{ row.value }}</dd>
              </div>
            </dl>
            <template #edit><ProductFields v-model:form="form" part="info" :errors="errors" /></template>
          </DlRecordSection>

          <DlRecordSection
            v-model:editing="editing.prices"
            :title="t('products.read.prices')"
            icon="tabler-cash"
            :can-edit="canUpdate"
            :saving="saving"
            class="bg-dl-paper"
            @save="save('prices')"
            @cancel="cancel('prices')"
          >
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div class="col-span-2 rounded-2xl bg-dl-signal-soft px-4 py-3">
                <p class="text-xs text-dl-muted">{{ t('products.fields.price') }} · {{ t('products.fields.priceHint') }}</p>
                <p class="font-display text-[22px] font-extrabold tabular-nums text-dl-fg">{{ text.money(product.price) }} <span class="text-sm font-semibold">{{ t('products.page.currency') }}</span></p>
              </div>
              <div v-for="key in PRICE_FIELDS" :key="key" class="rounded-2xl border border-dl-line px-3.5 py-2.5">
                <p class="text-xs text-dl-muted">{{ t(`products.fields.${key}`) }}</p>
                <p class="text-base font-bold tabular-nums" :class="product[key] == null ? 'text-dl-muted' : 'text-dl-fg'">{{ text.money(product[key]) }}</p>
              </div>
            </div>
            <template #edit><ProductFields v-model:form="form" part="prices" :errors="errors" /></template>
          </DlRecordSection>

          <DlRecordSection
            v-model:editing="editing.orders"
            :title="t('products.read.inOrders')"
            icon="tabler-shopping-cart"
            :can-edit="canUpdate"
            :saving="saving"
            class="bg-dl-paper"
            @save="save('orders')"
            @cancel="cancel('orders')"
          >
            <ul class="divide-y divide-dl-line-soft">
              <li v-for="flag in flags" :key="flag.label" class="flex items-start gap-3 py-2.5 first:pt-1">
                <!-- Read-only switch: changed with Edit -->
                <span class="relative mt-0.5 h-5 w-9 shrink-0 rounded-full" :class="flag.on ? 'bg-dl-ink' : 'bg-dl-line'" aria-hidden="true">
                  <span class="absolute top-[3px] h-3.5 w-3.5 rounded-full" :class="flag.on ? 'end-[3px] bg-dl-signal' : 'start-[3px] bg-dl-paper'" />
                </span>
                <span class="flex flex-col">
                  <strong class="font-semibold" :class="flag.on ? 'text-dl-fg' : 'text-dl-muted'">{{ flag.label }}<span class="sr-only">: {{ text.yesNo(flag.on) }}</span></strong>
                  <span class="text-xs text-dl-muted">{{ flag.hint }}</span>
                </span>
              </li>
            </ul>
            <p class="mb-1.5 mt-3 text-[11.5px] font-bold uppercase tracking-wide text-dl-muted">{{ t('products.fields.ugs') }}</p>
            <ul v-if="product.ugs?.length" class="flex flex-wrap gap-1.5">
              <li v-for="ug in product.ugs" :key="ug"><DlBadge size="sm">{{ ug }}</DlBadge></li>
            </ul>
            <p v-else>{{ t('products.read.noUg') }}</p>
            <template #edit><ProductFields v-model:form="form" part="orders" :errors="errors" /></template>
          </DlRecordSection>
        </div>

        <section class="rounded-2xl border border-dl-line bg-dl-paper px-3.5 pb-3.5 pt-3" :aria-label="t('products.photo.title')">
          <header class="mb-3 flex items-center gap-2.5">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-dl-line-soft text-dl-body"><DlIcon icon="tabler-photo" :size="17" /></span>
            <h3 class="flex-1 text-sm font-semibold">{{ t('products.photo.title') }}</h3>
            <template v-if="canUpdate">
              <button v-if="product.photo" type="button" class="text-[13px] font-semibold text-dl-muted hover:underline" :disabled="photoBusy" @click="removePhoto">{{ t('products.photo.remove') }}</button>
              <label class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-dl-line px-3 text-[13px] font-semibold hover:bg-dl-line-soft">
                <DlIcon icon="tabler-upload" :size="15" />
                {{ t(product.photo ? 'products.photo.change' : 'products.photo.add') }}
                <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" :disabled="photoBusy" @change="pickPhoto">
              </label>
            </template>
          </header>
          <div class="flex aspect-4/3 items-center justify-center overflow-hidden rounded-2xl bg-dl-mist text-dl-muted">
            <img v-if="product.photo?.url" :src="product.photo.url" :alt="product.name" class="h-full w-full object-contain">
            <DlIcon v-else icon="tabler-pill" :size="56" />
          </div>
          <p class="mt-2.5 text-xs text-dl-muted">{{ t('products.photo.hint') }}</p>
        </section>
      </div>
    </template>
  </div>
</template>
