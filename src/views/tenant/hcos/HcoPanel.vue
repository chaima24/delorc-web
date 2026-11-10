<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deleteHco, updateHco, type Hco } from '@/api/tenant/hcos'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useHcpLookups } from '@/views/tenant/hcps/useHcpLookups'
import HcoFields from './HcoFields.vue'
import { checkPart, toForm, toPayload, useHcoText, type HcoPart } from './hcoForm'

// An organisation in the side panel: its figures, Organisation and Place (each with its Edit), its
// departments, Delete. Professionals working there and visits join with their modules. Mockup: docs/design/customers-mockups/Organisations.html (frame 2)
const props = defineProps<{ hco: Hco }>()
const emit = defineEmits<{ changed: []; deleted: []; open: [id: number]; addDepartment: [parentId: number] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = computed(() => auth.can('hcos.update'))
const text = useHcoText()
const lookups = useHcpLookups()

const editing = reactive<Record<HcoPart, boolean>>({ info: false, place: false })
const form = ref(toForm())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(() => props.hco, value => {
  form.value = toForm(value)
  errors.value = {}
  editing.info = false
  editing.place = false
}, { immediate: true })

async function save(part: HcoPart) {
  errors.value = checkPart(form.value, part, { required: t('users.add.required'), coordinates: t('hcps.fields.gpsInvalid') })
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    await updateHco(props.hco.id, toPayload(form.value, [part]))
    toast.success(t('studio.list.toast.saved'))
    editing[part] = false
    if (part === 'info') lookups.reloadHcos()
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
function cancel(part: HcoPart) {
  editing[part] = false
  form.value = toForm(props.hco)
  errors.value = {}
}

async function remove() {
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: props.hco.name }),
    text: t('hcos.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteHco(props.hco.id)
    toast.success(t('studio.list.toast.deleted'))
    lookups.reloadHcos()
    emit('deleted')
  }
  catch (error) {
    // The API says why (e.g. "This organisation has departments: move or delete them first.").
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

// Professionals working there and this year's visits join these figures with their modules.
const tiles = computed(() => [
  { label: t('hcos.figures.departments'), value: n(props.hco.activity?.departments ?? 0) },
])
const SHOWN = 6
const showAll = ref(false)
const departments = computed(() => (showAll.value ? props.hco.children ?? [] : (props.hco.children ?? []).slice(0, SHOWN)))
const gps = computed(() => (props.hco.latitude != null && props.hco.longitude != null ? `${props.hco.latitude}, ${props.hco.longitude}` : null))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="hco.name">
    <template #media>
      <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-dl-signal text-dl-ink"><DlIcon :icon="hco.type === 'clinic' ? 'tabler-building-hospital' : 'tabler-hospital'" :size="26" /></span>
    </template>
    <template #badges>
      <span class="mt-1 flex flex-wrap gap-1.5">
        <DlBadge size="sm">{{ t(`hcos.types.${hco.type}`) }}</DlBadge>
        <DlBadge size="sm">{{ hco.one_key_id }}</DlBadge>
      </span>
    </template>

    <div class="flex flex-col gap-3.5">
      <dl class="grid grid-cols-3 gap-2">
        <div v-for="tile in tiles" :key="tile.label" class="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="truncate text-[11.5px] text-dl-muted">{{ tile.label }}</dt>
          <dd class="text-[15px] font-bold tabular-nums">{{ tile.value }}</dd>
        </div>
      </dl>

      <DlRecordSection v-model:editing="editing.info" :title="t('hcos.read.organisation')" :can-edit="canUpdate" :saving="saving" @save="save('info')" @cancel="cancel('info')">
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5">
          <dt class="text-dl-muted">{{ t('hcos.fields.name') }}</dt><dd>{{ hco.name }}</dd>
          <dt class="text-dl-muted">{{ t('hcos.fields.type') }}</dt><dd>{{ t(`hcos.types.${hco.type}`) }}</dd>
          <dt class="text-dl-muted">{{ t('hcos.fields.parent') }}</dt>
          <dd><button v-if="hco.parent" type="button" class="text-dl-cobalt hover:underline" @click="emit('open', hco.parent.id)">{{ hco.parent.name }}</button><span v-else>—</span></dd>
          <dt class="text-dl-muted">{{ t('hcps.fields.phone') }}</dt><dd>{{ hco.phone || '—' }}</dd>
          <dt class="text-dl-muted">{{ t('hcps.fields.oneKeyId') }}</dt><dd class="break-all">{{ hco.one_key_id }}</dd>
        </dl>
        <template #edit><HcoFields v-model:form="form" part="info" :errors="errors" :self-id="hco.id" /></template>
      </DlRecordSection>

      <DlRecordSection v-model:editing="editing.place" :title="t('hcps.read.place')" :can-edit="canUpdate" :saving="saving" @save="save('place')" @cancel="cancel('place')">
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5">
          <dt class="text-dl-muted">{{ t('hcps.fields.address') }}</dt><dd>{{ hco.address || '—' }}</dd>
          <dt class="text-dl-muted">{{ t('hcps.fields.commune') }}</dt><dd>{{ text.place(hco) }}</dd>
          <dt class="text-dl-muted">{{ t('hcps.fields.gps') }}</dt>
          <dd><a v-if="gps" :href="`https://www.google.com/maps?q=${gps}`" target="_blank" rel="noopener" class="text-dl-cobalt">{{ gps }} ↗</a><span v-else>—</span></dd>
        </dl>
        <template #edit><HcoFields v-model:form="form" part="place" :errors="errors" /></template>
      </DlRecordSection>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <header class="mb-1.5 flex items-center gap-2">
          <h3 class="flex-1 text-sm font-semibold">{{ t('hcos.read.departments') }}</h3>
          <DlButton v-if="auth.can('hcos.create')" variant="outline" size="sm" icon="tabler-plus" @click="emit('addDepartment', hco.id)">{{ t('hcos.read.addDepartment') }}</DlButton>
        </header>
        <ul v-if="departments.length" class="flex flex-col text-[13px]">
          <li v-for="department in departments" :key="department.id" class="border-b border-dl-line-soft last:border-0">
            <button type="button" class="flex w-full items-center justify-between gap-2 py-2 text-start hover:text-dl-cobalt" @click="emit('open', department.id)">
              <span>{{ department.name }}</span>
              <span class="shrink-0 text-dl-muted">›</span>
            </button>
          </li>
        </ul>
        <p v-else class="text-[13px] text-dl-muted">{{ t('hcos.read.noDepartments') }}</p>
        <button v-if="(hco.children?.length ?? 0) > SHOWN && !showAll" type="button" class="mt-1 text-[13px] font-semibold text-dl-cobalt hover:underline" @click="showAll = true">
          {{ t('hcos.read.more', { n: n((hco.children?.length ?? 0) - SHOWN) }) }}
        </button>
      </section>
    </div>

    <template v-if="auth.can('hcos.delete')" #footer>
      <DlButton variant="danger" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
