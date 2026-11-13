<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { labRuleTypesApi, type Lab, type LabRuleType, type LabRuleTypeFields } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useAuthStore } from '@/stores/auth'
import DeleteSection from '../geography/DeleteSection.vue'
import { usePanelAction } from '../geography/usePanelAction'

/** Adds a rule type to the lab, or with `ruleType` edits or deletes one. Every field, as before (docs/api/rule-types.md). */
const props = defineProps<{ lab: Lab; types: LabRuleType[]; ruleType?: LabRuleType }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const { errors, error, busy, run } = usePanelAction()
const auth = useAuthStore()
const canSave = computed(() => auth.can(props.ruleType ? 'rule-types.update' : 'rule-types.create'))

const KINDS = ['doctor', 'pharmacie', 'dentiste', 'wholestore', 'distributor']
const NONE = ''

const type = props.ruleType
const form = ref({
  name: type?.name ?? '',
  code: type?.code ?? '',
  parent_code: type?.parent_code ?? NONE,
  parent_key: type?.parent_key ?? '',
  is_visible: type?.is_visible ?? false,
  supports_sub_zone: type?.supports_sub_zone ?? false,
  supports_zone_type: type?.supports_zone_type ?? false,
  main_table: type?.main_table ?? '',
  main_model_class: type?.main_model_class ?? '',
  sub_zone_table: type?.sub_zone_table ?? '',
  sub_model_class: type?.sub_model_class ?? '',
  hcp_path: type?.hcp_path ?? '',
  hcp_sub_path: type?.hcp_sub_path ?? '',
  hcp_types: [...(type?.hcp_types ?? [])],
  user_path: type?.user_path ?? '',
  user_sub_path: type?.user_sub_path ?? '',
  user_skip_empty: type?.user_skip_empty ?? false,
})

const parentOptions = computed(() => [
  { value: NONE, label: t('central.labs.ruleTypes.form.noParent') },
  ...props.types.filter((other) => other.id !== type?.id).map((other) => ({ value: other.code, label: other.name })),
])
const inUse = computed(() => (type?.territories_count ?? 0) > 0)

function toggleKind(kind: string): void {
  const kinds = form.value.hcp_types
  form.value.hcp_types = kinds.includes(kind) ? kinds.filter((item) => item !== kind) : [...kinds, kind]
}

/** Empty text means "none" for the API. */
function fields(): LabRuleTypeFields {
  const text = (value: string) => value.trim() || null
  const f = form.value

  return {
    name: f.name.trim(),
    code: f.code.trim(),
    parent_code: f.parent_code || null,
    parent_key: f.parent_code ? text(f.parent_key) : null,
    is_visible: f.is_visible,
    supports_sub_zone: f.supports_sub_zone,
    supports_zone_type: f.supports_zone_type,
    main_table: f.main_table.trim(),
    main_model_class: f.main_model_class.trim(),
    sub_zone_table: f.supports_sub_zone ? text(f.sub_zone_table) : null,
    sub_model_class: f.supports_sub_zone ? text(f.sub_model_class) : null,
    hcp_path: text(f.hcp_path),
    hcp_sub_path: text(f.hcp_sub_path),
    hcp_types: f.hcp_types.length ? f.hcp_types : null,
    user_path: text(f.user_path),
    user_sub_path: text(f.user_sub_path),
    user_skip_empty: f.user_skip_empty,
  }
}

const save = () => run(
  () => (type ? labRuleTypesApi.update(props.lab.id, type.id, fields()) : labRuleTypesApi.add(props.lab.id, fields())),
  () => emit('changed'),
)
const remove = () => run(() => labRuleTypesApi.remove(props.lab.id, type!.id), () => emit('changed'))
const group = 'pt-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-dl-muted'
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="type ? type.name : t('central.labs.ruleTypes.add')">
    <form class="flex flex-col gap-3.5" @submit.prevent="save">
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <h3 :class="group">{{ t('central.labs.ruleTypes.form.theType') }}</h3>
      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.name" :label="t('central.labs.ruleTypes.name')" :hint="t('central.labs.ruleTypes.form.nameHint')" :error="errors.name" />
        <DlInput v-model="form.code" :label="t('central.labs.ruleTypes.code')" :hint="t('central.labs.ruleTypes.form.codeHint')" :error="errors.code" />
      </div>
      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <DlSelect v-model="form.parent_code" :label="t('central.labs.ruleTypes.form.parent')" :options="parentOptions" />
          <p class="mt-1 text-xs" :class="errors.parent_code ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.parent_code ?? t('central.labs.ruleTypes.form.parentHint') }}</p>
        </div>
        <DlInput v-if="form.parent_code" v-model="form.parent_key" :label="t('central.labs.ruleTypes.form.parentKey')" :hint="t('central.labs.ruleTypes.form.parentKeyHint')" :error="errors.parent_key" />
      </div>
      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.main_table" :label="t('central.labs.ruleTypes.form.table')" :error="errors.main_table" />
        <DlInput v-model="form.main_model_class" :label="t('central.labs.ruleTypes.form.model')" :error="errors.main_model_class" />
      </div>
      <div class="flex flex-col gap-1">
        <DlSwitch v-model="form.is_visible" :label="t('central.labs.ruleTypes.form.visible')" />
        <p class="text-xs text-dl-muted">{{ t('central.labs.ruleTypes.form.visibleHint') }}</p>
        <p v-if="errors.is_visible" class="text-xs text-dl-rejected">{{ errors.is_visible }}</p>
      </div>

      <h3 :class="group">{{ t('central.labs.ruleTypes.form.wilayaOptions') }}</h3>
      <div class="flex flex-wrap gap-x-5 gap-y-2">
        <DlSwitch v-model="form.supports_sub_zone" :label="t('central.labs.ruleTypes.form.subZones')" />
        <DlSwitch v-model="form.supports_zone_type" :label="t('central.labs.ruleTypes.form.zoneType')" />
      </div>
      <div v-if="form.supports_sub_zone" class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.sub_zone_table" :label="t('central.labs.ruleTypes.form.subTable')" :error="errors.sub_zone_table" />
        <DlInput v-model="form.sub_model_class" :label="t('central.labs.ruleTypes.form.subModel')" :error="errors.sub_model_class" />
      </div>

      <h3 :class="group">{{ t('central.labs.ruleTypes.hcpLink') }}</h3>
      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.hcp_path" :label="t('central.labs.ruleTypes.form.path')" :hint="t('central.labs.ruleTypes.form.hcpPathHint')" :error="errors.hcp_path" />
        <DlInput v-model="form.hcp_sub_path" :label="t('central.labs.ruleTypes.form.subPath')" :error="errors.hcp_sub_path" />
      </div>
      <fieldset class="flex flex-col gap-1.5">
        <legend class="mb-1 text-[13px] font-semibold">{{ t('central.labs.ruleTypes.form.kinds') }}</legend>
        <div class="flex flex-wrap gap-x-4 gap-y-1.5">
          <label v-for="kind in KINDS" :key="kind" class="flex items-center gap-2 text-sm">
            <input type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :checked="form.hcp_types.includes(kind)" @change="toggleKind(kind)">
            {{ t(`central.labs.ruleTypes.kind.${kind}`) }}
          </label>
        </div>
        <p class="text-xs" :class="errors.hcp_types ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.hcp_types ?? t('central.labs.ruleTypes.form.kindsHint') }}</p>
      </fieldset>

      <h3 :class="group">{{ t('central.labs.ruleTypes.userLink') }}</h3>
      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.user_path" :label="t('central.labs.ruleTypes.form.path')" :hint="t('central.labs.ruleTypes.form.userPathHint')" :error="errors.user_path" />
        <DlInput v-model="form.user_sub_path" :label="t('central.labs.ruleTypes.form.subPath')" :error="errors.user_sub_path" />
      </div>
      <div class="flex flex-col gap-1">
        <DlSwitch v-model="form.user_skip_empty" :label="t('central.labs.ruleTypes.form.skipEmpty')" />
        <p class="text-xs text-dl-muted">{{ t('central.labs.ruleTypes.form.skipEmptyHint') }}</p>
      </div>

      <div v-if="canSave" class="flex gap-2">
        <DlButton type="submit" variant="primary" size="sm" :loading="busy">{{ t(type ? 'common.actions.save' : 'central.labs.ruleTypes.addSubmit') }}</DlButton>
        <DlButton variant="outline" size="sm" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      </div>
    </form>

    <DeleteSection
      v-if="type && auth.can('rule-types.delete')"
      class="mt-4"
      :hint="inUse ? t('central.labs.ruleTypes.usedBy', { n: type.territories_count }, type.territories_count) : t('central.labs.ruleTypes.unused')"
      :blocked="inUse"
      :busy="busy"
      :reset-key="type.id"
      @confirm="remove"
    />
  </DlRecordPanel>
</template>
