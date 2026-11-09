<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAllBrands } from '@/api/tenant/brands'
import { fetchSpecialities } from '@/api/tenant/customerSetup'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'

// Specialities the team visits (at least one) and brands it promotes. `only` shows one of the two.
defineProps<{
  errors?: Record<string, string>
  only?: 'specialities' | 'brands'
}>()
const specialities = defineModel<number[]>('specialities', { default: () => [] })
const brands = defineModel<number[]>('brands', { default: () => [] })
const { t } = useI18n()

const specialityList = ref<{ id: number; name: string }[]>([])
const brandList = ref<{ id: number; name: string }[]>([])
onMounted(async () => {
  const [specialityPage, brandRows] = await Promise.all([fetchSpecialities({ per_page: 100, sort: 'name' }), fetchAllBrands()])
  specialityList.value = specialityPage.items
  brandList.value = brandRows
})

const toItems = (rows: { id: number; name: string }[]) =>
  rows.map(row => ({ value: row.id, label: row.name })).sort((a, b) => a.label.localeCompare(b.label))
const specialityItems = computed(() => toItems(specialityList.value))
const brandItems = computed(() => toItems(brandList.value))
</script>

<template>
  <CheckList
    v-if="only !== 'brands'"
    v-model="specialities"
    :legend="t('teams.fields.specialities')"
    :selected-label="t('teams.fields.chosen', { count: specialities.length }, specialities.length)"
    :search-label="t('teams.fields.searchSpecialities')"
    :items="specialityItems"
    :empty-text="t('teams.fields.noneFound')"
    :error="errors?.specialities"
  />
  <CheckList
    v-if="only !== 'specialities'"
    v-model="brands"
    :legend="t('teams.fields.brandsOptional')"
    :selected-label="t('teams.fields.chosen', { count: brands.length }, brands.length)"
    :search-label="t('teams.fields.searchBrands')"
    :items="brandItems"
    :empty-text="t('teams.fields.noneFound')"
    :error="errors?.brands"
  />
</template>
