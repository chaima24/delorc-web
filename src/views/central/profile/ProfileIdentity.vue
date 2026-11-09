<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { profileApi, type ProfileChanges } from '@/api/central/profile'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useAccessLabels } from '@/composables/useAccessLabels'
import { useAuthStore } from '@/stores/auth'

/** Name for everyone; email and phone only with profile.update-contact. A new email waits for its link. */
const { t, d } = useI18n()
const auth = useAuthStore()
const { roleLabel } = useAccessLabels()

const editing = ref(false)
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const message = ref<{ tone: 'error' | 'success'; text: string } | null>(null)
const form = reactive({ name: '', email: '', phone: '' })
const canContact = auth.can('profile.update-contact')

function reset(): void {
  const user = auth.user!
  Object.assign(form, { name: user.name, email: user.email, phone: user.phone ?? '' })
  errors.value = {}
  editing.value = false
}
reset()

/** Sends only what changed, like a PATCH. */
async function save(): Promise<void> {
  const user = auth.user!
  const changes: ProfileChanges = {}
  if (form.name !== user.name) changes.name = form.name
  if (canContact && form.email !== user.email) changes.email = form.email
  if (canContact && form.phone !== (user.phone ?? '')) changes.phone = form.phone || null

  busy.value = true
  message.value = null
  try {
    auth.user = await profileApi.update(changes)
    if (changes.email && auth.user.pending_email) {
      message.value = { tone: 'success', text: t('central.profile.linkSent', { email: auth.user.pending_email }) }
    }
    reset()
  } catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) message.value = { tone: 'error', text: errorMessage(error) ?? t('errors.network') }
  } finally {
    busy.value = false
  }
}

async function resend(): Promise<void> {
  auth.user = await profileApi.resendEmail()
  message.value = { tone: 'success', text: t('central.profile.linkSent', { email: auth.user.pending_email }) }
}

async function cancelEmail(): Promise<void> {
  await profileApi.cancelEmail()
  auth.user = { ...auth.user!, pending_email: null }
  message.value = null
}

const row = 'flex items-start gap-3 border-t border-dl-line-soft py-2.5 first:border-t-0'
</script>

<template>
  <div class="flex flex-col gap-3">
    <DlAlert v-if="message" :tone="message.tone">{{ message.text }}</DlAlert>

    <DlRecordSection v-if="auth.user" v-model:editing="editing" class="bg-dl-paper" :title="t('central.profile.identity')" icon="tabler-user" :saving="busy" @save="save" @cancel="reset">
      <dl class="text-sm">
        <div :class="row"><dt class="flex-1 font-semibold text-dl-fg">{{ t('central.users.name') }}</dt><dd>{{ auth.user.name }}</dd></div>
        <div :class="row">
          <dt class="flex-1 font-semibold text-dl-fg">
            {{ t('central.users.email') }}
            <span v-if="auth.user.pending_email" class="mt-0.5 block text-[12.5px] font-normal text-dl-muted">
              {{ t('central.profile.waiting', { email: auth.user.pending_email }) }} ·
              <button type="button" class="font-semibold text-dl-cobalt hover:underline" @click="resend">{{ t('central.profile.resend') }}</button> ·
              <button type="button" class="font-semibold text-dl-cobalt hover:underline" @click="cancelEmail">{{ t('common.actions.cancel') }}</button>
            </span>
          </dt>
          <dd>{{ auth.user.email }}</dd>
        </div>
        <div :class="row"><dt class="flex-1 font-semibold text-dl-fg">{{ t('central.users.phone') }}</dt><dd>{{ auth.user.phone ?? '—' }}</dd></div>
        <div :class="row">
          <dt class="flex-1 font-semibold text-dl-fg">
            {{ t('central.users.role') }}
            <span class="mt-0.5 block text-[12.5px] font-normal text-dl-muted">{{ t('central.profile.roleHint') }}</span>
          </dt>
          <dd><DlBadge tone="info">{{ auth.user.role ? roleLabel(auth.user.role) : '—' }}</DlBadge></dd>
        </div>
        <div :class="row">
          <dt class="flex-1 font-semibold text-dl-fg">{{ t('central.users.lastLogin') }}</dt>
          <dd>{{ auth.user.last_login_at ? d(new Date(auth.user.last_login_at), { dateStyle: 'medium', timeStyle: 'short' }) : t('central.users.never') }}</dd>
        </div>
      </dl>

      <template #edit>
        <DlInput v-model="form.name" :label="t('central.users.name')" :error="errors.name" autocomplete="name" />
        <div class="grid gap-3 sm:grid-cols-2">
          <DlInput
            v-model="form.email"
            type="email"
            :label="t('central.users.email')"
            :disabled="!canContact"
            :hint="canContact ? t('central.profile.emailHint') : t('central.profile.askAdmin')"
            :error="errors.email"
          />
          <DlInput
            v-model="form.phone"
            :label="t('central.users.phone')"
            :disabled="!canContact"
            :hint="canContact ? undefined : t('central.profile.askAdmin')"
            :error="errors.phone"
          />
        </div>
      </template>
    </DlRecordSection>
  </div>
</template>
