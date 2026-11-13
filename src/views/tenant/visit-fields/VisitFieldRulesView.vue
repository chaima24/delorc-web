<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchVisitFieldGrid, saveVisitFieldCell, type FieldValue, type VisitFieldGrid } from '@/api/tenant/visitFields'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { rulesSection } from '@/views/tenant/settings/shared/studioSections'

// Studio › Règles et plateforme › Champs du compte rendu: a grid, one row per field of a visit's report, one column
// per kind of target, one tab per field role. A role's tab only stores what differs from "Tous les rôles"; each
// change is saved at once. Mockup: docs/design/visits-mockups/ReportFields.html
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('validation-rules.update'))

const grid = ref<VisitFieldGrid | null>(null)
/** null = "Tous les rôles". */
const roleId = ref<number | null>(null)
const saving = ref<string | null>(null)
onMountedAndFocus(async () => { grid.value = await fetchVisitFieldGrid() })

const role = computed(() => grid.value?.roles.find(row => row.id === roleId.value) ?? null)
const kinds = computed(() => role.value?.kinds ?? grid.value?.kinds ?? [])
const groups = computed(() => {
  const list: { group: string; fields: VisitFieldGrid['fields'] }[] = []
  for (const field of grid.value?.fields ?? []) {
    const last = list[list.length - 1]
    if (last?.group === field.group) last.fields.push(field)
    else list.push({ group: field.group, fields: [field] })
  }
  return list
})
const baseOf = (kind: string, field: string): FieldValue => grid.value?.base[kind]?.[field] ?? 'optional'
const ownOf = (kind: string, field: string): FieldValue | null => role.value?.own[kind]?.[field] ?? null
/** What applies in the tab shown, and whether it is the role's own cell. */
const valueOf = (kind: string, field: string) => ownOf(kind, field) ?? baseOf(kind, field)
/** The select's value: the cell, or "inherit" for a role's untouched cell. */
const selected = (kind: string, field: string) => (role.value ? ownOf(kind, field) ?? 'inherit' : baseOf(kind, field))

async function change(kind: string, field: string, event: Event) {
  const picked = (event.target as HTMLSelectElement).value
  saving.value = `${kind}.${field}`
  try {
    grid.value = await saveVisitFieldCell({ role_id: roleId.value, kind, field, value: picked === 'inherit' ? null : (picked as FieldValue) })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
    grid.value = await fetchVisitFieldGrid()
  }
  finally {
    saving.value = null
  }
}

const TONE: Record<FieldValue, string> = { required: 'bg-dl-signal-soft text-dl-fg ring-1 ring-inset ring-dl-fg', optional: 'bg-dl-mist text-dl-body', hidden: 'bg-dl-rejected/10 text-dl-rejected' }
const VALUES: FieldValue[] = ['required', 'optional', 'hidden']
</script>

<template>
  <StudioListPage :section="rulesSection" :title="t('visitFields.title')">
    <p class="-mt-2 max-w-3xl text-[13px] text-dl-muted">{{ t('visitFields.subtitle') }}</p>
    <DlSkeleton v-if="!grid" class="h-[480px] rounded-3xl" />
    <template v-else>
      <div class="flex flex-wrap gap-1.5" role="tablist" :aria-label="t('visitFields.roles')">
        <button type="button" role="tab" :aria-selected="roleId === null" class="h-9 rounded-xl border px-3.5 text-[13px] font-semibold" :class="roleId === null ? 'border-dl-fg bg-dl-signal-soft text-dl-fg' : 'border-dl-line bg-dl-paper text-dl-body'" @click="roleId = null">{{ t('visitFields.allRoles') }}</button>
        <button v-for="row in grid.roles" :key="row.id" type="button" role="tab" :aria-selected="roleId === row.id" class="flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-semibold" :class="roleId === row.id ? 'border-dl-fg bg-dl-signal-soft text-dl-fg' : 'border-dl-line bg-dl-paper text-dl-body'" @click="roleId = row.id">
          {{ roleLabel(row.name) }}<span v-if="row.own_count" class="rounded-full bg-dl-signal px-1.5 text-[11px] text-dl-ink">{{ row.own_count }}</span>
        </button>
      </div>

      <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4 md:p-5">
        <table class="w-full border-separate border-spacing-y-1 text-[13px]">
          <thead>
            <tr>
              <th class="px-2 py-1.5 text-start text-xs font-semibold text-dl-muted">{{ t('visitFields.field') }}</th>
              <th v-for="kind in kinds" :key="kind" class="px-2 py-1.5 text-center text-xs font-semibold text-dl-muted">{{ t(`visitFields.kinds.${kind}`) }}</th>
            </tr>
          </thead>
          <tbody v-for="group in groups" :key="group.group">
            <tr><td :colspan="kinds.length + 1" class="px-2 pb-1 pt-3 text-[11.5px] font-bold uppercase tracking-wide text-dl-muted">{{ t(`visitFields.groups.${group.group}`) }}</td></tr>
            <tr v-if="group.group === 'brands'">
              <td class="px-2 py-1.5"><strong class="font-semibold">{{ t('visitFields.fixedBrand') }}</strong><small class="block text-[11.5px] text-dl-muted">{{ t('visitFields.fixedBrandHint') }}</small></td>
              <td v-for="kind in kinds" :key="kind" class="px-1 text-center"><span class="inline-flex h-8 w-[118px] items-center justify-center rounded-lg bg-dl-signal-soft text-dl-fg ring-1 ring-inset ring-dl-fg text-xs font-semibold opacity-50">{{ t('visitFields.values.required') }}</span></td>
            </tr>
            <tr v-for="field in group.fields" :key="field.key">
              <td class="px-2 py-1.5"><strong class="font-semibold">{{ t(`visitFields.fields.${field.key}`) }}</strong></td>
              <td v-for="kind in kinds" :key="kind" class="px-1 text-center">
                <span v-if="field.not_for?.includes(kind)" class="text-dl-muted" :title="t('visitFields.notFor')">—</span>
                <select
                  v-else
                  :value="selected(kind, field.key)"
                  :disabled="!canEdit || saving === `${kind}.${field.key}`"
                  :aria-label="`${t(`visitFields.fields.${field.key}`)} · ${t(`visitFields.kinds.${kind}`)}`"
                  class="h-8 w-[118px] cursor-pointer rounded-lg border-0 px-2 text-center text-xs font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt disabled:cursor-default [&>option]:bg-dl-paper [&>option]:text-dl-fg"
                  :class="[TONE[valueOf(kind, field.key)], role && !ownOf(kind, field.key) && 'opacity-50']"
                  @change="change(kind, field.key, $event)"
                >
                  <option v-if="role" value="inherit">{{ t('visitFields.inherit', { value: t(`visitFields.values.${baseOf(kind, field.key)}`) }) }}</option>
                  <option v-for="value in VALUES" :key="value" :value="value">{{ t(`visitFields.values.${value}`) }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-dl-muted">{{ t(role ? 'visitFields.hintRole' : 'visitFields.hintBase') }}</p>
    </template>
  </StudioListPage>
</template>
