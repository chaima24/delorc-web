<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import type { Role } from '@/api/central/roles'
import { usersApi, type CentralUser } from '@/api/central/users'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAccessLabels } from '@/composables/useAccessLabels'
import { LOCALES } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import RolePicker from './RolePicker.vue'

const props = defineProps<{ user: CentralUser; roles: Role[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [user: CentralUser] }>()

const { t, d } = useI18n()
const auth = useAuthStore()
const { roleLabel } = useAccessLabels()

const ownerRole = computed(() => props.roles.find((role) => role.is_super)?.name ?? 'owner')
const isSelf = computed(() => auth.user?.id === props.user.id)
/** The API refuses these too: only an owner acts on an owner. */
const locked = computed(() => props.user.role === ownerRole.value && !auth.user?.is_super)
const canUpdate = computed(() => auth.can('users.update') && !locked.value)
const canChangeRole = computed(() => auth.can('users.change-role') && !locked.value && !isSelf.value)
const canResetFactor = computed(() => auth.can('users.reset-second-factor') && !locked.value && !isSelf.value && props.user.two_factor_method !== 'none')
const roleChoices = computed(() => props.roles.filter((role) => !role.is_super || auth.user?.is_super))
const status = computed<{ tone: 'success' | 'warning' | 'neutral'; key: string }>(() => {
  if (!props.user.is_active) return { tone: 'neutral', key: 'inactive' }

  return props.user.has_password ? { tone: 'success', key: 'active' } : { tone: 'warning', key: 'linkSent' }
})
const localeOptions = LOCALES.map((value) => ({ value, label: t(`common.locale.${value}`) }))

const editingDetails = ref(false)
const editingRole = ref(false)
const confirmingStatus = ref(false)
const details = ref({ name: '', email: '', phone: '', locale: 'fr' })
const role = ref<string | null>(null)
const errors = ref<Record<string, string>>({})
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const busy = ref(false)

function reset(): void {
  const { name, email, phone, locale } = props.user
  details.value = { name, email, phone: phone ?? '', locale }
  role.value = props.user.role
  editingDetails.value = false
  editingRole.value = false
  confirmingStatus.value = false
  errors.value = {}
  error.value = null
}

watch(() => props.user.id, () => {
  notice.value = null
  reset()
}, { immediate: true })

/** Runs one API call and shows its answer, whatever the action. */
async function run(action: () => Promise<CentralUser | void>, done?: string): Promise<void> {
  busy.value = true
  errors.value = {}
  error.value = null
  notice.value = null
  try {
    const user = await action()
    if (user) emit('changed', user)
    await Promise.resolve()
    reset()
    notice.value = done ?? null
  } catch (failure) {
    errors.value = fieldErrors(failure)
    if (!Object.keys(errors.value).length || errors.value.user) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}

const saveDetails = () => run(() => usersApi.update(props.user.id, { ...details.value, phone: details.value.phone || null }))
const saveRole = () => run(() => usersApi.changeRole(props.user.id, role.value ?? ''))
const sendLink = () => run(() => usersApi.sendAccess(props.user.id).then(() => undefined), t('central.users.linkSent'))
const resetFactor = () => run(() => usersApi.resetSecondFactor(props.user.id), t('central.users.factorReset'))
const switchActive = () => run(() => usersApi.update(props.user.id, { is_active: !props.user.is_active }))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="user.name">
    <template #badges>
      <div class="flex flex-wrap gap-1.5">
        <DlBadge :tone="status.tone" dot size="sm">{{ t(`central.users.status.${status.key}`) }}</DlBadge>
        <DlBadge v-if="user.role" size="sm">{{ roleLabel(user.role) }}</DlBadge>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <DlAlert v-if="notice" tone="success">{{ notice }}</DlAlert>
      <DlAlert v-if="locked">{{ t('central.users.ownerLocked') }}</DlAlert>

      <DlRecordSection v-model:editing="editingDetails" :title="t('central.users.details')" :can-edit="canUpdate" :saving="busy" @save="saveDetails" @cancel="reset">
        {{ user.email }}<br>
        <template v-if="user.phone">{{ user.phone }} · </template>{{ t(`common.locale.${user.locale}`) }}
        <template #edit>
          <DlInput v-model="details.name" :label="t('central.users.name')" :error="errors.name" />
          <DlInput v-model="details.email" :label="t('central.users.email')" type="email" :error="errors.email" />
          <DlInput v-model="details.phone" :label="t('central.users.phone')" :error="errors.phone" />
          <DlSelect v-model="details.locale" :label="t('central.users.language')" :options="localeOptions" />
        </template>
      </DlRecordSection>

      <DlRecordSection v-model:editing="editingRole" :title="t('central.users.role')" :can-edit="canChangeRole && roles.length > 0" :saving="busy" @save="saveRole" @cancel="reset">
        {{ user.role ? roleLabel(user.role) : '—' }}
        <template #edit>
          <RolePicker v-model="role" :roles="roleChoices" :error="errors.role" />
        </template>
      </DlRecordSection>

      <DlRecordSection :title="t('central.users.signingIn')" :can-edit="false">
        {{ t('central.users.lastLogin') }}: {{ user.last_login_at ? d(new Date(user.last_login_at)) : t('central.users.never') }}<br>
        {{ t('central.users.secondFactor') }}: {{ t(`central.users.factor.${user.two_factor_method}`) }}
        <div v-if="canUpdate || canResetFactor" class="mt-2 flex flex-wrap gap-2">
          <DlButton v-if="canUpdate" variant="outline" size="sm" :disabled="busy" @click="sendLink">{{ t('central.users.sendLink') }}</DlButton>
          <DlButton v-if="canResetFactor" variant="outline" size="sm" :disabled="busy" @click="resetFactor">{{ t('central.users.resetFactor') }}</DlButton>
        </div>
      </DlRecordSection>

      <DlRecordSection v-if="canUpdate && !isSelf" :title="t(user.is_active ? 'central.users.deactivate' : 'central.users.reactivate')" :can-edit="false">
        <template v-if="user.is_active">{{ t('central.users.deactivateHint') }}</template>
        <div class="mt-2 flex gap-2">
          <DlButton v-if="user.is_active && !confirmingStatus" variant="outline" size="sm" @click="confirmingStatus = true">{{ t('central.users.deactivate') }}</DlButton>
          <template v-else-if="user.is_active">
            <DlButton variant="danger" size="sm" :loading="busy" @click="switchActive">{{ t('central.users.deactivateConfirm') }}</DlButton>
            <DlButton variant="ghost" size="sm" @click="confirmingStatus = false">{{ t('common.actions.cancel') }}</DlButton>
          </template>
          <DlButton v-else variant="outline" size="sm" :loading="busy" @click="switchActive">{{ t('central.users.reactivate') }}</DlButton>
        </div>
      </DlRecordSection>
    </div>
  </DlRecordPanel>
</template>
