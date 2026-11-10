<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { updateUser, type TenantUser } from '@/api/tenant/users'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { loadCommunes, useUserLookups } from '../useUserLookups'
import { currentManagers, currentTeams, useUserText } from '../userDisplay'

// The profile card and "Maintenant" (teams). Manager, territory and "Cycle actuel" come back with their modules.
const props = defineProps<{ user: TenantUser }>()
const emit = defineEmits<{ changed: []; go: [tab: string] }>()
const { t } = useI18n()
const toast = useToast()
const text = useUserText()
const auth = useAuthStore()
const lookups = useUserLookups()

const editing = ref(false)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const form = reactive({
  first_name: '', last_name: '', email: '', phone: '', address: '',
  wilaya_id: null as number | null, commune_id: null as number | null, language_id: null as number | null,
  avatar: null as File | null, avatar_remove: false,
})
const communes = ref<{ value: number; label: string }[]>([])

function reset() {
  const user = props.user
  Object.assign(form, {
    first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone ?? '', address: user.address ?? '',
    wilaya_id: user.commune?.wilaya?.id ?? null, commune_id: user.commune?.id ?? null,
    language_id: user.language_id ?? null, avatar: null, avatar_remove: false,
  })
  errors.value = {}
}
watch(() => props.user, reset, { immediate: true })
watch(editing, value => { if (value) reset() })
watch(() => form.wilaya_id, async (id, previous) => {
  communes.value = id ? await loadCommunes(id) : []
  if (previous !== undefined && previous !== null && id !== previous) form.commune_id = null
}, { immediate: true })

const languageOptions = computed(() => lookups.languages.value.map(language => ({ value: language.id, label: language.native_name || language.name })))
const photoUrl = computed(() => (form.avatar ? URL.createObjectURL(form.avatar) : form.avatar_remove ? null : props.user.avatar?.url))
function pickPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) Object.assign(form, { avatar: file, avatar_remove: false })
}

async function save() {
  saving.value = true
  errors.value = {}
  try {
    await updateUser(props.user.id, {
      first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(),
      phone: form.phone.replace(/\s/g, ''), address: form.address.trim() || null,
      commune_id: form.commune_id, language_id: form.language_id,
      avatar: form.avatar, avatar_remove: form.avatar_remove,
    })
    toast.success(t('studio.list.toast.saved'))
    editing.value = false
    emit('changed')
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

const commune = computed(() => [props.user.commune?.name, props.user.commune?.wilaya?.name].filter(Boolean).join(' · ') || '—')
const added = computed(() => props.user.created_by?.full_name
  ? t('fieldSetup.read.addedBy', { name: props.user.created_by.full_name, date: text.date(props.user.created_at) })
  : t('fieldSetup.read.added', { date: text.date(props.user.created_at) }))
</script>

<template>
  <div class="grid items-start gap-4 lg:grid-cols-2">
    <DlRecordSection v-model:editing="editing" :title="t('users.read.profile')" icon="tabler-user" :can-edit="auth.can('users.update')" :saving="saving" class="bg-dl-paper" @save="save" @cancel="editing = false">
      <dl class="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">
        <dt class="text-dl-muted">{{ t('users.fields.firstName') }}</dt><dd>{{ user.first_name }}</dd>
        <dt class="text-dl-muted">{{ t('users.fields.lastName') }}</dt><dd>{{ user.last_name }}</dd>
        <dt class="text-dl-muted">{{ t('users.fields.email') }}</dt><dd class="break-all">{{ user.email }}</dd>
        <dt class="text-dl-muted">{{ t('users.fields.phone') }}</dt><dd>{{ user.phone || '—' }}</dd>
        <dt class="text-dl-muted">{{ t('users.fields.address') }}</dt><dd>{{ user.address || '—' }}</dd>
        <dt class="text-dl-muted">{{ t('users.fields.commune') }}</dt><dd>{{ commune }}</dd>
        <dt class="text-dl-muted">{{ t('users.fields.language') }}</dt><dd>{{ user.language?.name ?? '—' }}</dd>
        <dt class="text-dl-muted">{{ t('studio.list.added') }}</dt><dd>{{ added }}</dd>
      </dl>
      <template #edit>
        <div class="flex items-center gap-3">
          <DlAvatar :name="`${form.first_name} ${form.last_name}`" :src="photoUrl" size="lg" />
          <label class="cursor-pointer text-[13px] font-semibold text-dl-cobalt hover:underline">
            {{ t('users.read.changePhoto') }}
            <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="pickPhoto">
          </label>
          <button v-if="photoUrl" type="button" class="text-[13px] font-semibold text-dl-muted hover:underline" @click="Object.assign(form, { avatar: null, avatar_remove: true })">
            {{ t('users.read.removePhoto') }}
          </button>
        </div>
        <p v-if="errors.avatar" class="text-xs text-dl-rejected">{{ errors.avatar }}</p>
        <div class="flex flex-col gap-3.5">
          <DlInput v-model="form.first_name" :label="t('users.fields.firstName')" :error="errors.first_name" />
          <DlInput v-model="form.last_name" :label="t('users.fields.lastName')" :error="errors.last_name" />
        </div>
        <DlInput v-model="form.email" type="email" :label="t('users.fields.email')" :error="errors.email" />
        <DlInput v-model="form.phone" type="tel" :label="t('users.fields.phone')" :error="errors.phone" />
        <DlInput v-model="form.address" :label="t('users.fields.addressOptional')" :error="errors.address" />
        <div class="flex flex-col gap-3.5">
          <DlCombobox v-model="form.wilaya_id" :label="t('users.fields.wilaya')" :options="lookups.wilayas.value" />
          <DlCombobox v-model="form.commune_id" :label="t('users.fields.commune')" :options="communes" :disabled="!form.wilaya_id" :error="errors.commune_id" />
        </div>
        <DlSelect v-model="form.language_id" :label="t('users.fields.language')" :options="languageOptions" />
      </template>
    </DlRecordSection>

    <div class="flex flex-col gap-4">
      <section class="rounded-2xl border border-dl-line bg-dl-paper px-3.5 py-3">
        <header class="mb-2 flex items-center gap-2">
          <h3 class="flex-1 text-sm font-semibold">{{ t('users.read.now') }}</h3>
          <button type="button" class="text-[13px] font-semibold text-dl-cobalt hover:underline" @click="emit('go', 'assignments')">{{ t('users.read.seeHistory') }}</button>
        </header>
        <dl class="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[13px]">
          <dt class="text-dl-muted">{{ t('users.columns.team') }}</dt>
          <dd class="flex flex-col gap-1">
            <span v-for="team in currentTeams(user)" :key="team.id" class="flex flex-wrap items-center gap-1.5">
              <strong>{{ team.name }}</strong>
              <DlBadge v-if="team.isPrimary && currentTeams(user).length > 1" size="sm">{{ t('users.history.main') }}</DlBadge>
              <span class="text-dl-muted">{{ text.period(team) }}</span>
            </span>
            <span v-if="!currentTeams(user).length">—</span>
          </dd>
          <dt class="text-dl-muted">{{ t('users.columns.manager') }}</dt>
          <dd class="flex flex-col gap-1">
            <span v-for="manager in currentManagers(user)" :key="manager.id"><strong>{{ manager.name }}</strong> <span class="text-dl-muted">{{ text.period(manager) }}</span></span>
            <span v-if="!currentManagers(user).length">—</span>
          </dd>
        </dl>
      </section>
    </div>
  </div>
</template>
