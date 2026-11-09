<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { updateUser, type TenantUser } from '@/api/tenant/users'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type { useUserActions } from '../useUserActions'
import { useUserLookups } from '../useUserLookups'
import { accountStatus, useUserText } from '../userDisplay'

// Sign-in (login, password through the access link, second step), role, deactivate.
const props = defineProps<{ user: TenantUser; actions: ReturnType<typeof useUserActions> }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const text = useUserText()
const lookups = useUserLookups()

const status = computed(() => accountStatus(props.user))
const busy = computed(() => props.actions.busy.value)
const isSelf = computed(() => props.user.id === auth.user?.id)

const editingRole = ref(false)
const role = ref<string | null>(null)
const saving = ref(false)
watch(editingRole, value => { if (value) role.value = props.user.role })
async function saveRole() {
  if (!role.value) return
  saving.value = true
  try {
    await updateUser(props.user.id, { role: role.value })
    toast.success(t('studio.list.toast.saved'))
    editingRole.value = false
    emit('changed')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

const password = computed(() => {
  if (status.value === 'active') return t('users.access.passwordSet')
  if (status.value === 'invited') return t('users.access.passwordInvited', { date: text.dateTime(props.user.access_link_expires_at) })
  return t('users.access.passwordNone')
})
const method = computed(() => props.user.two_factor_method ?? 'none')
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Sign-in: login · password · second step -->
    <section class="rounded-2xl border border-dl-line bg-dl-paper px-4 py-4" :aria-label="t('users.read.signIn')">
      <h3 class="mb-3 text-sm font-semibold">{{ t('users.read.signIn') }}</h3>
      <div class="grid gap-4 md:grid-cols-3 md:divide-x md:divide-dl-line-soft rtl:md:divide-x-reverse">
        <div class="flex min-w-0 flex-col gap-1">
          <span class="text-xs text-dl-muted">{{ t('users.access.login') }}</span>
          <strong class="break-all text-[13px]">{{ user.email }}</strong>
          <span class="mt-2 text-xs text-dl-muted">{{ t('users.access.lastLogin') }}</span>
          <strong class="text-[13px]">{{ user.last_login_at ? text.dateTime(user.last_login_at) : t('users.access.neverSignedIn') }}</strong>
        </div>
        <div class="flex min-w-0 flex-col items-start gap-1 md:ps-4">
          <span class="text-xs text-dl-muted">{{ t('users.access.password') }}</span>
          <strong class="text-[13px]">{{ password }}</strong>
          <DlButton v-if="auth.can('users.send-access') && status !== 'inactive'" class="mt-1.5" variant="outline" size="sm" icon="tabler-mail-forward" :loading="busy" @click="actions.sendAccess(user)">
            {{ t(status === 'invited' ? 'users.actions.resendAccess' : 'users.actions.sendAccess') }}
          </DlButton>
        </div>
        <div class="flex min-w-0 flex-col items-start gap-1 md:ps-4">
          <span class="text-xs text-dl-muted">{{ t('users.access.twoStep') }}</span>
          <strong class="text-[13px]">{{ t(`users.access.method.${method}`) }}</strong>
          <span class="text-xs text-dl-muted">{{ t('users.access.twoStepHint') }}</span>
          <DlButton
            v-if="auth.can('users.reset-second-factor') && method !== 'none' && status !== 'inactive' && !isSelf"
            class="mt-1.5"
            variant="outline"
            size="sm"
            icon="tabler-shield-off"
            :loading="busy"
            @click="actions.resetSecondFactor(user)"
          >
            {{ t('users.access.reset') }}
          </DlButton>
        </div>
      </div>
    </section>

    <div class="grid items-start gap-4 lg:grid-cols-2">
      <DlRecordSection v-model:editing="editingRole" :title="t('users.columns.role')" icon="tabler-shield" class="bg-dl-paper" :can-edit="auth.can('users.change-role') && !isSelf" :saving="saving" :save-label="t('users.access.changeRole')" @save="saveRole" @cancel="editingRole = false">
        <p>
          <strong class="text-dl-fg">{{ text.role(user) }}</strong> · {{ t('users.access.roleLine') }}
          <RouterLink :to="{ name: 'tenant-roles' }" class="font-semibold text-dl-cobalt">{{ t('access.title.roles') }}</RouterLink>
        </p>
        <template #edit>
          <DlSelect v-model="role" :label="t('users.columns.role')" :options="lookups.roles.value" />
          <p class="text-xs text-dl-muted">{{ t('users.access.roleHint') }}</p>
        </template>
      </DlRecordSection>

      <!-- Same structure as the Role card (DlRecordSection): icon, title, action on the right, text -->
      <section v-if="auth.can('users.update') && !isSelf" class="rounded-2xl border border-dl-line bg-dl-paper" :aria-label="t('users.access.account')">
        <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-dl-line-soft text-dl-body">
            <DlIcon :icon="status === 'inactive' ? 'tabler-user-off' : 'tabler-user-check'" :size="17" />
          </span>
          <h3 class="flex-1 text-sm font-semibold">{{ t('users.access.account') }}</h3>
          <DlButton variant="outline" size="sm" :icon="status === 'inactive' ? 'tabler-user-check' : 'tabler-user-off'" :loading="busy" @click="actions.setActive(user, status === 'inactive')">
            {{ t(status === 'inactive' ? 'users.actions.reactivate' : 'users.actions.deactivate') }}
          </DlButton>
        </header>
        <p class="px-3.5 pb-3 text-[13px] text-dl-body">{{ t(status === 'inactive' ? 'users.access.inactiveText' : 'users.access.activeText') }}</p>
      </section>
    </div>
  </div>
</template>
