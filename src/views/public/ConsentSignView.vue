<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldErrors } from '@/api/errors'
import { answerConsentLink, fetchConsentLink, sendConsentCode, type ConsentCodeChannel, type ConsentLinkView } from '@/api/tenant/consents'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlLogo from '@/components/DlLogo.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { currentLocale, setLocale } from '@/plugins/i18n'
import { useLabStore } from '@/stores/lab'
import SignaturePad from './SignaturePad.vue'

// Public page (no login) a professional opens from a consent link or QR code: the lab, their name, the
// text, e-mail / phone, how they prefer to be contacted, an optional signature, I agree / I don't agree.
// Either answer sends a 6-digit code that proves it is them (nobody answers for them), by e-mail (default) or
// SMS when the lab has SMS, to the contact on their record (or the one they give); then a thank-you.
// Shows nothing else about them. Mockup: docs/design/customers-mockups/Consents.html (frame 5)
const props = defineProps<{ token: string }>()
const { t } = useI18n()
const labStore = useLabStore()
// The lab's languages (loaded before any lab page opens), to switch the page's texts.
const locale = ref(currentLocale())
async function useLanguage(code: string) {
  await setLocale(code).catch(() => undefined)
  locale.value = currentLocale()
}

const view = ref<ConsentLinkView | null>(null)
const notFound = ref(false)
const email = ref('')
const phone = ref('')
const signature = ref<string | null>(null)
/** How they prefer to be contacted: saved on their record when they agree. */
const prefers = ref<'email' | 'phone'>('email')
const errors = ref<Record<string, string>>({})
const sending = ref<boolean | null>(null)
const answered = ref<boolean | null>(null)

// Step 2 (agreeing): the code.
const step = ref<'form' | 'code'>('form')
/** The answer being confirmed with the code: true = agree, false = refuse. */
const pending = ref<boolean | null>(null)
const channel = ref<ConsentCodeChannel>('email')
const code = ref('')
const sentTo = ref('')
const wait = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
onBeforeUnmount(() => clearInterval(timer))

onMounted(async () => {
  try {
    view.value = await fetchConsentLink(props.token)
    email.value = view.value.email ?? ''
    phone.value = view.value.phone ?? ''
    prefers.value = view.value.contacted_by === 'phone' ? 'phone' : 'email'
  }
  catch {
    notFound.value = true
  }
})

const languages = computed(() => labStore.lab?.languages ?? [])
const name = computed(() => view.value?.name ?? '')
const done = computed(() => answered.value !== null || view.value?.state === 'given' || view.value?.state === 'refused')

function showErrors(error: unknown) {
  const found = fieldErrors(error)
  if (!Object.keys(found).length) {
    errors.value = { form: t('consents.page.failed') }
    return
  }
  // Used, deactivated or replaced meanwhile.
  if (found.token && view.value) view.value = { ...view.value, state: 'inactive' }
  errors.value = found
}

const preferences = computed(() => [{ value: 'email', label: t('consents.page.byEmail') }, { value: 'phone', label: t('consents.page.byPhone') }])
const prefersModel = computed({
  get: () => prefers.value as string,
  set: value => { prefers.value = value as 'email' | 'phone' },
})
const channels = computed(() => [{ value: 'email', label: t('consents.page.byEmail') }, { value: 'sms', label: t('consents.page.bySms') }])
const channelModel = computed({
  get: () => channel.value as string,
  set: value => {
    channel.value = value as ConsentCodeChannel
    askCode()
  },
})

/** "I agree" / "I don't agree": sends the code, then asks for it to confirm that answer. */
function choose(approval: boolean) {
  pending.value = approval
  askCode()
}

/** Sends the code (again, or by another channel). */
async function askCode() {
  errors.value = {}
  const sms = channel.value === 'sms'
  const typed = (sms ? phone.value : email.value).trim()
  if (!view.value?.code_to[channel.value] && !typed) {
    errors.value = sms ? { phone: t('consents.page.needPhone') } : { email: t('consents.page.needEmail') }
    if (step.value === 'code') errors.value = { code: errors.value.phone ?? errors.value.email ?? '' }
    return
  }
  sending.value = true
  try {
    const result = await sendConsentCode(props.token, channel.value, typed || null)
    sentTo.value = result.sent_to
    step.value = 'code'
    code.value = ''
    wait.value = result.wait
    clearInterval(timer)
    timer = setInterval(() => {
      wait.value = Math.max(0, wait.value - 1)
      if (!wait.value) clearInterval(timer)
    }, 1000)
  }
  catch (error) {
    showErrors(error)
  }
  finally {
    sending.value = null
  }
}

async function answer(approval: boolean) {
  errors.value = {}
  sending.value = approval
  try {
    view.value = await answerConsentLink(props.token, {
      approval,
      email: email.value.trim() || null,
      phone: phone.value.trim() || null,
      code: code.value.trim(),
      signature: signature.value,
      contacted_by: approval ? prefers.value : undefined,
    })
    answered.value = approval
  }
  catch (error) {
    showErrors(error)
  }
  finally {
    sending.value = null
  }
}
</script>

<template>
  <div class="flex min-h-dvh justify-center bg-dl-mist px-4 py-6 text-dl-fg">
    <main class="flex w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-dl-paper">
      <header class="flex items-center gap-3 bg-dl-ink px-5 py-4 text-dl-on-ink">
        <DlLogo :size="30" on-dark />
        <strong class="flex-1 truncate">{{ view?.lab ?? '' }}</strong>
        <nav v-if="languages.length > 1" class="flex gap-1 text-xs" :aria-label="t('consents.page.language')">
          <button
            v-for="language in languages"
            :key="language.code"
            type="button"
            class="rounded-md px-1.5 py-0.5"
            :class="locale === language.code ? 'bg-dl-signal font-bold text-dl-ink' : 'text-dl-on-ink-muted hover:text-dl-on-ink'"
            @click="useLanguage(language.code)"
          >
            {{ language.code === 'ar' ? 'ع' : language.code.toUpperCase() }}
          </button>
        </nav>
      </header>

      <div class="flex flex-1 flex-col gap-4 p-5">
        <div v-if="!view && !notFound" class="flex flex-col gap-3" aria-hidden="true">
          <DlSkeleton class="h-16 rounded-2xl" />
          <DlSkeleton class="h-32 rounded-2xl" />
        </div>

        <div v-else-if="notFound" class="flex flex-col items-center gap-3 py-16 text-center">
          <DlIcon icon="tabler-link-off" :size="40" class="text-dl-muted" />
          <h1 class="font-display text-[22px] font-extrabold">{{ t('consents.page.notFoundTitle') }}</h1>
          <p class="text-sm text-dl-muted">{{ t('consents.page.notFoundText') }}</p>
        </div>

        <div v-else-if="done" class="flex flex-col items-center gap-3 py-16 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-[20px] bg-dl-signal text-dl-ink"><DlIcon icon="tabler-check" :size="30" /></span>
          <h1 class="font-display text-[24px] font-extrabold">{{ t('consents.page.thanks', { name }) }}</h1>
          <p class="text-sm text-dl-muted">{{ t(answered === null ? 'consents.page.alreadyAnswered' : 'consents.page.saved') }}</p>
        </div>

        <div v-else-if="view?.state === 'inactive'" class="flex flex-col items-center gap-3 py-16 text-center">
          <DlIcon icon="tabler-link-off" :size="40" class="text-dl-muted" />
          <h1 class="font-display text-[22px] font-extrabold">{{ t('consents.page.inactiveTitle') }}</h1>
          <p class="text-sm text-dl-muted">{{ t('consents.page.inactiveText', { lab: view.lab }) }}</p>
        </div>

        <!-- Step 2: the code that proves it is them -->
        <form v-else-if="view && step === 'code'" class="flex flex-col gap-4" @submit.prevent="answer(pending === true)">
          <h1 class="font-display text-[24px] font-extrabold leading-tight">{{ t('consents.page.codeTitle') }}</h1>
          <p class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold" :class="pending ? 'bg-dl-signal-soft' : 'bg-dl-rejected/10 text-dl-rejected'">
            <DlIcon :icon="pending ? 'tabler-circle-check' : 'tabler-circle-x'" :size="18" />
            {{ t(pending ? 'consents.page.confirmingAgree' : 'consents.page.confirmingRefuse') }}
          </p>
          <div v-if="view.sms_available" class="flex flex-col gap-1.5">
            <span class="text-[13px] font-semibold">{{ t('consents.page.receiveBy') }}</span>
            <DlSegmented v-model="channelModel" :label="t('consents.page.receiveBy')" :items="channels" block />
          </div>
          <p class="text-sm text-dl-body">{{ t(channel === 'sms' ? 'consents.page.codeSentSms' : 'consents.page.codeSent', { email: sentTo }) }}</p>
          <DlInput v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" :label="t('consents.page.code')" :error="errors.code || errors.form" />
          <DlButton type="submit" :variant="pending ? 'primary' : 'danger'" size="lg" block :loading="sending !== null" :disabled="code.trim().length !== 6">{{ t('consents.page.confirm') }}</DlButton>
          <div class="flex items-center justify-between text-sm">
            <button type="button" class="font-semibold text-dl-muted hover:underline" @click="step = 'form'">{{ t('users.add.back') }}</button>
            <button type="button" class="font-semibold text-dl-cobalt hover:underline disabled:text-dl-muted disabled:no-underline" :disabled="wait > 0 || sending !== null" @click="askCode">
              {{ wait > 0 ? t('consents.page.resendIn', { s: wait }) : t('consents.page.resend') }}
            </button>
          </div>
        </form>

        <template v-else-if="view">
          <h1 class="font-display text-[24px] font-extrabold leading-tight">{{ t('consents.page.question', { name, lab: view.lab }) }}</h1>
          <p class="rounded-2xl bg-dl-mist p-3.5 text-sm leading-relaxed text-dl-body">{{ t('consents.page.text', { lab: view.lab }) }}</p>
          <DlInput
            v-model="email"
            type="email"
            :label="t('hcps.fields.email')"
            :hint="view.code_to.email ? undefined : t('consents.page.emailForCode')"
            :error="errors.email"
          />
          <DlInput v-model="phone" type="tel" :label="t('hcps.fields.phone')" :error="errors.phone" />
          <div class="flex flex-col gap-1.5">
            <span class="text-[13px] font-semibold">{{ t('consents.page.prefers') }}</span>
            <DlSegmented v-model="prefersModel" :label="t('consents.page.prefers')" :items="preferences" block />
          </div>
          <SignaturePad v-model="signature" :label="t('consents.page.signature')" />
          <p v-if="errors.form" class="text-sm text-dl-rejected" role="alert">{{ errors.form }}</p>
          <DlButton variant="primary" size="lg" block :loading="sending !== null && pending === true" :disabled="sending !== null" @click="choose(true)">{{ t('consents.page.agree') }}</DlButton>
          <DlButton variant="outline" block :loading="sending !== null && pending === false" :disabled="sending !== null" @click="choose(false)">{{ t('consents.page.disagree') }}</DlButton>
          <p class="text-center text-xs text-dl-muted">{{ view.code_to.email ? t('consents.page.codeWillGoBoth', { email: view.code_to.email }) : t('consents.page.personal') }}</p>
        </template>
      </div>
    </main>
  </div>
</template>
