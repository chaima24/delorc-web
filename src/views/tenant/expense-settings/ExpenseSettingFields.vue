<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'

export interface ExpenseSettingForm {
  /** A group (role and/or team; both empty = everyone) or one user. */
  target: 'group' | 'user'
  role_id: number | null
  team_id: number | null
  user_id: number | null
  start_date: string
  end_date: string
  restitution_price_per_km_in: string | number
  restitution_price_per_km_out: string | number
  max_km_in: string | number
  max_km_out: string | number
  max_night: string | number
  price_per_night: string | number
  price_per_meal: string | number
  max_meals_per_night: string | number
}

type Option = { value: number; label: string }

/** One part of the expense setting form, one field per line, used by the edit sections and the "Add" steps. */
defineProps<{
  part: 'who' | 'km' | 'stays'
  errors: Record<string, string>
  roles: Option[]
  teams: Option[]
  users: Option[]
}>()

const form = defineModel<ExpenseSettingForm>({ required: true })
const { t } = useI18n()

const ALL = 'all'
const targetItems = computed(() => [
  { value: 'group', label: t('fieldSetup.target.group') },
  { value: 'user', label: t('fieldSetup.target.user') },
])
const target = computed({
  get: () => form.value.target as string,
  set: value => { form.value.target = value as ExpenseSettingForm['target'] },
})
// "All roles" / "All teams" stand for an empty value.
const role = computed({
  get: () => form.value.role_id ?? ALL,
  set: value => { form.value.role_id = value === ALL || value == null ? null : Number(value) },
})
const team = computed({
  get: () => form.value.team_id ?? ALL,
  set: value => { form.value.team_id = value === ALL || value == null ? null : Number(value) },
})
</script>

<template>
  <div v-if="part === 'who'" class="flex flex-col gap-3.5">
    <DlSegmented v-model="target" :label="t('fieldSetup.columns.appliesTo')" :items="targetItems" block />
    <template v-if="form.target === 'group'">
      <div class="flex flex-col gap-3.5">
        <DlSelect v-model="role" :label="t('fieldSetup.columns.role')" :options="[{ value: ALL, label: t('fieldSetup.filter.allRoles') }, ...roles]" />
        <DlSelect v-model="team" :label="t('fieldSetup.columns.team')" :options="[{ value: ALL, label: t('fieldSetup.filter.allTeams') }, ...teams]" />
      </div>
      <p class="-mt-1.5 text-xs text-dl-muted">{{ t('fieldSetup.targetHint') }}</p>
    </template>
    <DlSelect v-else v-model="form.user_id" :label="t('fieldSetup.scope.user')" :options="users" />
    <p v-if="errors.role_id || errors.team_id || errors.user_id" class="-mt-1.5 text-xs text-dl-rejected">
      {{ errors.role_id || errors.team_id || errors.user_id }}
    </p>
    <div class="flex flex-col gap-3.5">
      <DlInput v-model="form.start_date" type="date" :label="t('fieldSetup.fields.startDate')" :error="errors.start_date" required />
      <DlInput v-model="form.end_date" type="date" :label="t('fieldSetup.fields.endDate')" :error="errors.end_date" :hint="t('fieldSetup.endDateHint')" />
    </div>
  </div>

  <div v-else-if="part === 'km'" class="flex flex-col gap-3">
    <div class="flex flex-col gap-3.5">
      <DlInput v-model="form.restitution_price_per_km_in" type="number" step="any" min="0" :label="t('fieldSetup.fields.kmPriceIn')" :error="errors.restitution_price_per_km_in" />
      <DlInput v-model="form.restitution_price_per_km_out" type="number" step="any" min="0" :label="t('fieldSetup.fields.kmPriceOut')" :error="errors.restitution_price_per_km_out" />
      <DlInput v-model="form.max_km_in" type="number" min="0" :label="t('fieldSetup.fields.maxKmIn')" :error="errors.max_km_in" />
      <DlInput v-model="form.max_km_out" type="number" min="0" :label="t('fieldSetup.fields.maxKmOut')" :error="errors.max_km_out" />
    </div>
    <p class="text-xs text-dl-muted">{{ t('fieldSetup.kmHint') }}</p>
  </div>

  <div v-else class="flex flex-col gap-3.5">
    <DlInput v-model="form.price_per_night" type="number" step="any" min="0" :label="t('fieldSetup.fields.nightPrice')" :error="errors.price_per_night" />
    <DlInput v-model="form.max_night" type="number" min="0" :label="t('fieldSetup.fields.maxNights')" :error="errors.max_night" />
    <DlInput v-model="form.price_per_meal" type="number" step="any" min="0" :label="t('fieldSetup.fields.mealPrice')" :error="errors.price_per_meal" />
    <DlInput v-model="form.max_meals_per_night" type="number" min="0" max="10" :label="t('fieldSetup.fields.maxMealsPerNight')" :hint="t('fieldSetup.fields.maxMealsPerNightHint')" :error="errors.max_meals_per_night" />
  </div>
</template>
