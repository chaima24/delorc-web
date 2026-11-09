<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { authApi } from '@/api/auth'
import { profileApi } from '@/api/central/profile'
import { errorMessage, fieldErrors } from '@/api/errors'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import PasswordInput from '@/components/PasswordInput.vue'
import DlInput from '@/components/DlInput.vue'
import { useAuthStore } from '@/stores/auth'

/**
 * Password and second factor. One action open at a time, inside the card:
 * change password, set up the app (QR → first code → recovery codes), new codes, email code, turn off.
 * Sensitive actions ask the password again, like the API.
 */
const { t } = useI18n()
const auth = useAuthStore()

type Action = 'password' | 'app' | 'codes' | 'email' | 'off' | null
const action = ref<Action>(null)
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const message = ref<{ tone: 'error' | 'success'; text: string } | null>(null)
const form = reactive({ current: '', password: '', confirmation: '', code: '' })
const setup = ref<{ secret: string; qr_svg: string } | null>(null)
const codes = ref<string[] | null>(null)

const factor = computed(() => auth.user!.two_factor)

async function open(next: Action): Promise<void> {
  Object.assign(form, { current: '', password: '', confirmation: '', code: '' })
  errors.value = {}
  message.value = null
  codes.value = null
  setup.value = null
  action.value = next
  if (next === 'app') {
    setup.value = await authApi.setupApp()
  }
}

/** Runs one action; field errors go under their field, anything else on top. */
async function run(work: () => Promise<void>): Promise<void> {
  busy.value = true
  errors.value = {}
  try {
    await work()
  } catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) message.value = { tone: 'error', text: errorMessage(error) ?? t('errors.network') }
  } finally {
    busy.value = false
  }
}

const done = (text: string) => {
  action.value = null
  message.value = { tone: 'success', text }
}

const changePassword = () => run(async () => {
  // A new session for this device; the other devices are signed out by the API.
  auth.startSession(await profileApi.changePassword(form.current, form.password, form.confirmation))
  done(t('central.profile.passwordChanged'))
})

const confirmApp = () => run(async () => {
  const answer = await authApi.confirmApp(form.code)
  auth.user = answer.user
  codes.value = answer.recovery_codes
  setup.value = null
})

const newCodes = () => run(async () => {
  codes.value = await authApi.newRecoveryCodes(form.current)
  auth.user = { ...auth.user!, two_factor: { ...factor.value, recovery_codes_left: codes.value.length } }
})

const useEmail = () => run(async () => {
  auth.user = await authApi.useEmailCode(form.current)
  done(t('central.profile.emailOn'))
})

const turnOff = () => run(async () => {
  auth.user = await authApi.disableTwoFactor(form.current)
  done(t('central.profile.factorOff'))
})

function download(): void {
  const file = new Blob([`${(codes.value ?? []).join('\n')}\n`], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(file)
  link.download = 'delorc-recovery-codes.txt'
  link.click()
  URL.revokeObjectURL(link.href)
}

const row = 'flex flex-wrap items-center gap-3 border-t border-dl-line-soft py-2.5 first:border-t-0'
const small = 'mt-0.5 block text-[12.5px] font-normal text-dl-muted'
</script>

<template>
  <div class="flex flex-col gap-3">
    <DlAlert v-if="message" :tone="message.tone">{{ message.text }}</DlAlert>

    <section class="rounded-2xl border border-dl-line bg-dl-paper" :aria-label="t('central.profile.security')">
      <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
        <span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-dl-line-soft text-dl-body"><DlIcon icon="tabler-shield-lock" :size="17" /></span>
        <h3 class="flex-1 text-sm font-semibold">{{ t('central.profile.security') }}</h3>
      </header>

      <dl class="px-3.5 pb-3 text-sm">
        <div :class="row">
          <dt class="flex-1 font-semibold">{{ t('central.profile.password') }}</dt>
          <dd><DlButton variant="outline" size="sm" @click="open('password')">{{ t('central.profile.changePassword') }}</DlButton></dd>
        </div>
        <div :class="row">
          <dt class="flex-1 font-semibold">
            {{ t('central.users.secondFactor') }}
            <span :class="small">{{ factor.required ? t('central.profile.required') : t('central.profile.optional') }}</span>
          </dt>
          <dd><DlBadge :tone="factor.method === 'none' ? 'neutral' : 'success'">{{ t(`central.profile.method.${factor.method}`) }}</DlBadge></dd>
        </div>
        <div v-if="factor.method === 'app'" :class="row">
          <dt class="flex-1 font-semibold">
            {{ t('central.profile.recoveryCodes') }}
            <span :class="small">{{ t('central.profile.codesLeft', { count: factor.recovery_codes_left }) }}</span>
          </dt>
          <dd><DlButton variant="outline" size="sm" @click="open('codes')">{{ t('central.profile.newCodes') }}</DlButton></dd>
        </div>
        <div :class="row">
          <dt class="flex-1 font-semibold">{{ t('central.profile.methodLabel') }}</dt>
          <dd class="flex flex-wrap gap-2">
            <DlButton v-if="factor.method !== 'app'" variant="outline" size="sm" @click="open('app')">{{ t('central.profile.useApp') }}</DlButton>
            <DlButton v-if="factor.method !== 'email'" variant="outline" size="sm" @click="open('email')">{{ t('central.profile.useEmail') }}</DlButton>
            <DlButton v-if="factor.method !== 'none'" variant="outline" size="sm" :disabled="factor.required" @click="open('off')">{{ t('central.profile.turnOff') }}</DlButton>
          </dd>
        </div>
        <p v-if="factor.required && factor.method !== 'none'" class="pt-1 text-[12.5px] text-dl-muted">{{ t('central.profile.cannotTurnOff') }}</p>
      </dl>
    </section>

    <!-- The open action, edited in place like a record card -->
    <section v-if="action" class="rounded-2xl border-2 border-dl-fg bg-dl-paper px-3.5 py-3">
      <form v-if="action === 'password'" class="flex flex-col gap-3.5" @submit.prevent="changePassword">
        <h3 class="text-sm font-semibold">{{ t('central.profile.changePassword') }}</h3>
        <PasswordInput v-model="form.current" :label="t('central.profile.currentPassword')" :error="errors.current_password" autocomplete="current-password" />
        <div class="grid gap-3 sm:grid-cols-2">
          <PasswordInput v-model="form.password" :label="t('auth.setPassword.password')" :hint="t('auth.setPassword.rule')" :error="errors.password" autocomplete="new-password" />
          <PasswordInput v-model="form.confirmation" :label="t('auth.setPassword.confirm')" autocomplete="new-password" />
        </div>
        <p class="text-[12.5px] text-dl-muted">{{ t('central.profile.othersSignedOut') }}</p>
        <div class="flex justify-end gap-2">
          <DlButton variant="outline" size="sm" @click="action = null">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" variant="dark" size="sm" :loading="busy">{{ t('central.profile.changePassword') }}</DlButton>
        </div>
      </form>

      <template v-else-if="(action === 'app' || action === 'codes') && codes">
        <h3 class="text-sm font-semibold">{{ t('central.profile.yourCodes') }}</h3>
        <DlAlert v-if="action === 'app'" tone="success" class="mt-3">{{ t('central.profile.appOn') }}</DlAlert>
        <p class="mt-3 text-[13.5px] text-dl-body">{{ t('central.profile.codesHelp') }}</p>
        <ul class="mt-3 grid grid-cols-2 gap-2 font-mono text-[13.5px] sm:grid-cols-4">
          <li v-for="code in codes" :key="code" class="rounded-[9px] bg-dl-mist px-2 py-2 text-center">{{ code }}</li>
        </ul>
        <div class="mt-3.5 flex justify-end gap-2">
          <DlButton variant="outline" size="sm" icon="tabler-download" @click="download">{{ t('central.profile.download') }}</DlButton>
          <DlButton variant="dark" size="sm" @click="action = null">{{ t('central.profile.saved') }}</DlButton>
        </div>
      </template>

      <form v-else-if="action === 'app'" class="flex flex-col gap-3.5" @submit.prevent="confirmApp">
        <h3 class="text-sm font-semibold">{{ t('central.profile.useApp') }}</h3>
        <div v-if="setup" class="flex flex-wrap items-center gap-4">
          <!-- The API draws the QR code as SVG. -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="h-[140px] w-[140px] shrink-0 rounded-xl bg-white p-2 [&_svg]:h-full [&_svg]:w-full" v-html="setup.qr_svg" />
          <div class="flex min-w-0 flex-1 flex-col gap-2 text-[13.5px] text-dl-body">
            <span>{{ t('central.profile.appStep1') }}</span>
            <span>{{ t('central.profile.appKey') }} <code class="break-all font-mono text-dl-fg">{{ setup.secret }}</code></span>
            <span>{{ t('central.profile.appStep2') }}</span>
          </div>
        </div>
        <DlInput v-model="form.code" :label="t('auth.twoFactor.code')" code inputmode="numeric" autocomplete="one-time-code" :error="errors.code" />
        <div class="flex justify-end gap-2">
          <DlButton variant="outline" size="sm" @click="action = null">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" variant="dark" size="sm" :loading="busy" :disabled="!setup">{{ t('central.profile.confirm') }}</DlButton>
        </div>
      </form>

      <form v-else class="flex flex-col gap-3.5" @submit.prevent="action === 'codes' ? newCodes() : action === 'email' ? useEmail() : turnOff()">
        <h3 class="text-sm font-semibold">{{ t(`central.profile.confirmTitle.${action}`) }}</h3>
        <p class="text-[13.5px] text-dl-body">{{ t(`central.profile.confirmText.${action}`) }}</p>
        <PasswordInput v-model="form.current" :label="t('central.profile.currentPassword')" :error="errors.password ?? errors.method" autocomplete="current-password" />
        <div class="flex justify-end gap-2">
          <DlButton variant="outline" size="sm" @click="action = null">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" :variant="action === 'off' ? 'danger' : 'dark'" size="sm" :loading="busy">{{ t(`central.profile.confirmTitle.${action}`) }}</DlButton>
        </div>
      </form>
    </section>
  </div>
</template>
