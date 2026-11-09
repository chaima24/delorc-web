<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deleteBrand, updateBrand, type Brand, type BrandPayload } from '@/api/tenant/brands'
import DlBadge from '@/components/DlBadge.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu, { type DlMenuItem } from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useUserText } from '@/views/tenant/users/userDisplay'
import BrandTeamsField from './BrandTeamsField.vue'

// A brand in the side panel: name, its products, the teams that promote it, what uses it.
// Mockup: docs/design/studio-mockups/Brands.html
const props = defineProps<{ brand: Brand }>()
const emit = defineEmits<{ changed: [brand: Brand]; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useUserText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = computed(() => auth.can('brands.update'))

const editing = reactive({ name: false, teams: false })
const form = reactive({ name: '', teams: [] as number[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)

function resetForm() {
  Object.assign(form, { name: props.brand.name, teams: props.brand.teams?.map(team => team.id) ?? [] })
  errors.value = {}
}
watch(() => props.brand, resetForm, { immediate: true })
watch(() => props.brand.id, () => { editing.name = editing.teams = false })

async function save(payload: BrandPayload, section: keyof typeof editing) {
  saving.value = true
  errors.value = {}
  try {
    const brand = await updateBrand(props.brand.id, payload)
    toast.success(t('studio.list.toast.saved'))
    editing[section] = false
    emit('changed', brand)
  }
  catch (error) {
    errors.value = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, message]) => [key.split('.')[0]!, message]))
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
function saveName() {
  if (!form.name.trim()) {
    errors.value = { name: t('users.add.required') }
    return
  }
  save({ name: form.name.trim() }, 'name')
}
function cancel(section: keyof typeof editing) {
  editing[section] = false
  resetForm()
}

async function remove() {
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: props.brand.name }),
    text: t('brands.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteBrand(props.brand.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const menuItems = computed<DlMenuItem[]>(() =>
  auth.can('brands.delete') ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }] : [])

const productsCount = computed(() => props.brand.products_count ?? 0)
const moreProducts = computed(() => productsCount.value - (props.brand.products?.length ?? 0))
const tiles = computed(() => [
  { label: t('brands.columns.products'), value: productsCount.value },
  { label: t('brands.read.teams'), value: props.brand.teams?.length ?? 0 },
])
const uses = computed(() => Object.entries(props.brand.uses ?? {}).filter(([, count]) => count > 0))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="brand.name">
    <template #badges>
      <span class="mt-1 text-xs text-dl-muted">{{ t('brands.read.added', { date: text.date(brand.created_at) }) }}</span>
    </template>
    <template v-if="menuItems.length" #actions>
      <DlMenu :label="t('fieldSetup.menu.label')" :items="menuItems" always-menu />
    </template>

    <div class="flex flex-col gap-3.5">
      <dl class="grid grid-cols-2 gap-2">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ tile.label }}</dt>
          <dd class="font-display text-lg font-extrabold">{{ n(tile.value) }}</dd>
        </div>
      </dl>

      <DlRecordSection
        v-model:editing="editing.name"
        :title="t('brands.fields.name')"
        :can-edit="canUpdate"
        :saving="saving"
        @save="saveName"
        @cancel="cancel('name')"
      >
        {{ brand.name }}
        <template #edit>
          <DlInput v-model="form.name" :label="t('brands.fields.name')" hide-label :error="errors.name" />
        </template>
      </DlRecordSection>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3" :aria-label="t('brands.columns.products')">
        <header class="mb-1.5 flex items-center gap-2.5">
          <h3 class="flex-1 text-sm font-semibold">{{ t('brands.read.products', { count: n(productsCount) }) }}</h3>
          <RouterLink
            v-if="productsCount && auth.can('products.show')"
            :to="{ name: 'tenant-products', query: { brand: brand.id } }"
            class="text-[13px] font-semibold text-dl-cobalt no-underline hover:underline"
          >
            {{ t('brands.read.seeProducts') }}
          </RouterLink>
        </header>
        <p v-if="!productsCount" class="text-[13px] text-dl-body">{{ t('brands.read.noProducts') }}</p>
        <ul v-else class="flex flex-col gap-1 text-[13px]">
          <li v-for="product in brand.products" :key="product.id">{{ product.name }}</li>
          <li v-if="moreProducts > 0" class="text-xs text-dl-muted">{{ t('brands.read.moreProducts', { count: n(moreProducts) }) }}</li>
        </ul>
      </section>

      <DlRecordSection
        v-model:editing="editing.teams"
        :title="t('brands.fields.teams')"
        :can-edit="canUpdate"
        :saving="saving"
        @save="save({ teams: form.teams }, 'teams')"
        @cancel="cancel('teams')"
      >
        <ul v-if="brand.teams?.length" class="flex flex-wrap gap-1.5">
          <li v-for="team in brand.teams" :key="team.id"><DlBadge size="sm">{{ team.name }}</DlBadge></li>
        </ul>
        <p v-else>{{ t('brands.read.noTeam') }}</p>
        <template #edit>
          <BrandTeamsField v-model="form.teams" :error="errors.teams" />
          <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('brands.read.teamsSync') }}</p>
        </template>
      </DlRecordSection>

      <section v-if="uses.length" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('brands.read.usedBy') }}</h3>
        <dl class="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 text-[13px]">
          <template v-for="[kind, count] in uses" :key="kind">
            <dt>{{ t(`brands.uses.${kind}`) }}</dt><dd class="text-dl-muted tabular-nums">{{ n(count) }}</dd>
          </template>
        </dl>
      </section>
    </div>
  </DlRecordPanel>
</template>
