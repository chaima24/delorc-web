<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createUser, type TenantUser } from '@/api/tenant/users'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSteps from '@/components/DlSteps.vue'
import { useToast } from '@/composables/useToast'
import { loadCommunes, useUserLookups } from './useUserLookups'

// "Add a user" in steps: person · role. Team, manager, territory, rules and the first cycle
// join the second step (and a third) with their modules.
const emit = defineEmits<{ created: [user: TenantUser] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const lookups = useUserLookups()

function blank() {
  return {
    first_name: '', last_name: '', email: '', phone: '', address: '',
    wilaya_id: null as number | null, commune_id: null as number | null, language_id: null as number | null,
    avatar: null as File | null,
    role: null as string | null, send_access: true,
  }
}
const form = reactive(blank())
const step = ref(0)
const errors = ref<Record<string, string>>({})
const saving = ref(false)

watch(open, value => {
  if (!value) return
  Object.assign(form, blank(), { language_id: defaultLanguage() })
  step.value = 0
  errors.value = {}
})

// Default language: French when the lab has it (labs usually work in French), else the first one.
const defaultLanguage = () => lookups.languages.value.find(language => language.code === 'fr')?.id ?? lookups.languages.value[0]?.id ?? null
watch(lookups.languages, () => {
  if (!form.language_id) form.language_id = defaultLanguage()
}, { immediate: true })
const languageItems = computed(() => lookups.languages.value.map(language => ({ value: String(language.id), label: language.native_name || language.name })))
const languageModel = computed({
  get: () => String(form.language_id ?? ''),
  set: value => { form.language_id = Number(value) },
})

const communes = ref<{ value: number; label: string }[]>([])
watch(() => form.wilaya_id, async id => {
  form.commune_id = null
  communes.value = id ? await loadCommunes(id) : []
})

const photoUrl = computed(() => (form.avatar ? URL.createObjectURL(form.avatar) : null))
function pickPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) form.avatar = file
}

const steps = computed(() => [t('users.add.steps.person'), t('users.add.steps.role')])
const LAST = 1

/** Fields of each step, to send the API's errors back to the right step. */
const STEP_FIELDS: string[][] = [
  ['first_name', 'last_name', 'email', 'phone', 'address', 'commune_id', 'language_id', 'avatar'],
  ['role'],
]
const required = (value: unknown) => (value === null || value === '' ? t('users.add.required') : null)
function check(index: number): boolean {
  const found: Record<string, string> = {}
  const need = (key: string, value: unknown) => { const error = required(value); if (error) found[key] = error }
  if (index === 0) {
    need('first_name', form.first_name.trim()); need('last_name', form.last_name.trim()); need('email', form.email.trim())
    need('phone', form.phone.trim()); need('commune_id', form.commune_id); need('language_id', form.language_id)
    if (form.phone && !/^\d{10}$/.test(form.phone.replace(/\s/g, ''))) found.phone = t('users.add.phoneFormat')
  }
  if (index === 1) need('role', form.role)
  errors.value = found
  return !Object.keys(found).length
}
function next() {
  if (check(step.value)) step.value++
}

async function save() {
  if (!check(LAST)) return
  saving.value = true
  try {
    const user = await createUser({
      user: {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(),
        phone: form.phone.replace(/\s/g, ''), address: form.address.trim() || null,
        commune_id: form.commune_id, language_id: form.language_id, avatar: form.avatar,
      },
      role: form.role!,
      send_access: form.send_access,
    })
    toast.success(form.send_access ? t('users.add.createdInvited', { email: user.email }) : t('users.add.created'))
    emit('created', user)
  }
  catch (error) {
    // "user.email" → "email"
    const found: Record<string, string> = {}
    for (const [key, message] of Object.entries(fieldErrors(error))) found[key.startsWith('user.') ? key.slice(5) : key] ??= message
    if (!Object.keys(found).length) {
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return
    }
    errors.value = found
    const first = STEP_FIELDS.findIndex(fields => fields.some(field => field in found))
    if (first >= 0) step.value = first
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('users.add.title')">
    <div class="flex flex-col gap-4">
      <DlSteps :steps="steps" :current="step" />

      <!-- 1 · Person -->
      <form v-if="step === 0" id="user-add" class="flex flex-col gap-3.5" novalidate @submit.prevent="next">
        <label class="flex cursor-pointer items-center gap-3">
          <DlAvatar :name="`${form.first_name} ${form.last_name}`.trim() || '+'" :src="photoUrl" size="lg" tone="neutral" />
          <span class="text-xs text-dl-muted">{{ t('users.add.photoHint') }}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="pickPhoto">
        </label>
        <p v-if="errors.avatar" class="-mt-2 text-xs text-dl-rejected">{{ errors.avatar }}</p>
        <div class="flex flex-col gap-3.5">
          <DlInput v-model="form.first_name" :label="t('users.fields.firstName')" :error="errors.first_name" autocomplete="off" />
          <DlInput v-model="form.last_name" :label="t('users.fields.lastName')" :error="errors.last_name" autocomplete="off" />
        </div>
        <DlInput v-model="form.email" type="email" :label="t('users.fields.email')" :hint="t('users.add.emailHint')" :error="errors.email" autocomplete="off" />
        <DlInput v-model="form.phone" type="tel" inputmode="numeric" :label="t('users.fields.phone')" :error="errors.phone" placeholder="0555123456" />
        <div class="flex flex-col gap-3.5">
          <DlCombobox v-model="form.wilaya_id" :label="t('users.fields.wilaya')" :options="lookups.wilayas.value" />
          <DlCombobox v-model="form.commune_id" :label="t('users.fields.commune')" :options="communes" :disabled="!form.wilaya_id" :error="errors.commune_id" />
        </div>
        <DlInput v-model="form.address" :label="t('users.fields.addressOptional')" :error="errors.address" />
        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] font-semibold">{{ t('users.fields.language') }}</span>
          <DlSegmented v-if="languageItems.length" v-model="languageModel" :label="t('users.fields.language')" :items="languageItems" block />
          <p v-if="errors.language_id" class="text-xs text-dl-rejected">{{ errors.language_id }}</p>
        </div>
      </form>

      <!-- 2 · Role -->
      <form v-else id="user-add" class="flex flex-col gap-3.5" novalidate @submit.prevent="save">
        <DlSelect v-model="form.role" :label="t('users.columns.role')" :options="lookups.roles.value" :placeholder="t('users.add.choose')" />
        <p v-if="errors.role" class="-mt-2 text-xs text-dl-rejected">{{ errors.role }}</p>
        <label class="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5" :class="form.send_access ? 'bg-dl-signal-soft ring-[1.5px] ring-dl-fg ring-inset' : 'border border-dl-line'">
          <input v-model="form.send_access" type="checkbox" class="mt-0.5 h-[18px] w-[18px] accent-dl-ink">
          <span class="flex flex-col">
            <strong class="text-sm">{{ t('users.add.sendAccess') }}</strong>
            <span class="text-xs text-dl-muted">{{ t('users.add.sendAccessHint') }}</span>
          </span>
        </label>
      </form>
    </div>

    <template #footer>
      <DlButton variant="ghost" @click="step ? step-- : (open = false)">{{ t(step ? 'users.add.back' : 'common.actions.cancel') }}</DlButton>
      <DlButton v-if="step < LAST" type="submit" form="user-add" variant="dark" class="ms-auto">{{ t('users.add.next') }}</DlButton>
      <DlButton v-else type="submit" form="user-add" variant="primary" class="ms-auto" :loading="saving">
        {{ form.first_name.trim() ? t('users.add.saveNamed', { name: form.first_name.trim() }) : t('users.add.save') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>
