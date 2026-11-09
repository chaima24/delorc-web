<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAllTeams, type Team } from '@/api/tenant/teams'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'

// Teams that promote the brand: the same link as "Brands promoted" on each team.
defineProps<{ error?: string }>()
const model = defineModel<number[]>({ required: true })
const { t } = useI18n()
const teams = ref<Team[]>([])
onMounted(async () => { teams.value = await fetchAllTeams() })

const items = computed(() => teams.value
  .map(team => ({ value: team.id, label: team.name, hint: team.status === false ? t('teams.status.inactive') : undefined }))
  .sort((a, b) => a.label.localeCompare(b.label)))
</script>

<template>
  <CheckList
    v-model="model"
    :legend="t('brands.fields.teams')"
    :selected-label="t('teams.fields.chosen', { count: model.length }, model.length)"
    :search-label="t('brands.fields.searchTeams')"
    :items="items"
    :empty-text="t('brands.fields.noTeams')"
    :error="error"
  />
</template>
