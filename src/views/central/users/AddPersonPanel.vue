<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import type { Role } from '@/api/central/roles'
import { usersApi, type CentralUser } from '@/api/central/users'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import { LOCALES } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import RolePicker from './RolePicker.vue'

const props = defineProps<{ roles: Role[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [user: CentralUser] }>()

const { t } = useI18n()
const auth = useAuthStore()

const name = ref('')
const email = ref('')
const phone = ref('')
const locale = ref<string>('fr')
const role = ref<string | null>(null)
const errors = ref<Record<string, string>>({})
const error = ref<string | null>(null)
const busy = ref(false)

const localeOptions = LOCALES.map((value) => ({ value, label: t(`common.locale.${value}`) }))
const choices = computed(() => props.roles.filter((item) => !item.is_super || auth.user?.is_super))

async function submit(): Promise<void> {
  busy.value = true
  errors.value = {}
  error.value = null
  try {
    emit('added', await usersApi.create({ name: name.value, email: email.value, phone: phone.value || null, locale: locale.value, role: role.value ?? '' }))
  } catch (failure) {
    errors.value = fieldErrors(failure)
    if (!Object.keys(errors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('central.users.add')">
    <form id="add-person" class="flex flex-col gap-3.5" @submit.prevent="submit">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <DlInput v-model="name" :label="t('central.users.name')" :error="errors.name" required />
      <DlInput v-model="email" :label="t('central.users.email')" type="email" :error="errors.email" required />
      <DlInput v-model="phone" :label="t('central.users.phone')" :error="errors.phone" />
      <DlSelect v-model="locale" :label="t('central.users.language')" :options="localeOptions" />
      <RolePicker v-model="role" :roles="choices" :error="errors.role" />
      <p class="text-xs text-dl-muted">{{ t('central.users.linkHint') }}</p>
    </form>
    <template #footer>
      <DlButton type="submit" form="add-person" variant="primary" :loading="busy">{{ t('central.users.addSubmit') }}</DlButton>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
