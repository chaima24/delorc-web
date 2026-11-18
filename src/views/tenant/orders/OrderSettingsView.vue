<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchOrderSettings, saveOrderSettings, type OrderSettings } from '@/api/tenant/orders'
import { rolesApi, type Role } from '@/api/tenant/roles'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

// Commandes › Réglages, as Coaching › Réglages: the strategic threshold (16a), how far back an order may be dated and
// the negotiated discount per customer (16b). Each card saves its own keys. Mockup: Orders.html frame 9.
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('orders-setup.update'))

type Card = 'strategic' | 'date' | 'negotiated'
const saved = ref<OrderSettings | null>(null)
const form = ref({ strategic: '', days: '', negotiated: false, roleIds: [] as number[] })
const errors = ref<Record<string, string>>({})
const saving = ref<Card | null>(null)
function reset(settings: OrderSettings) {
  saved.value = settings
  form.value = { strategic: String(settings.strategic_percentage), days: settings.max_backdate_days == null ? '' : String(settings.max_backdate_days), negotiated: settings.negotiated_discount, roleIds: [...settings.negotiated_role_ids] }
}
fetchOrderSettings().then(reset)

const roles = ref<Role[]>([])
onMountedAndFocus(async () => { roles.value = (await rolesApi.list()).filter(role => !role.is_super) })
const roleItems = computed(() => roles.value.map(role => ({ value: role.id, label: roleLabel(role.name) })).sort((a, b) => a.label.localeCompare(b.label)))

const changed = computed(() => {
  const s = saved.value
  if (!s) return { strategic: false, date: false, negotiated: false }
  return {
    strategic: form.value.strategic !== String(s.strategic_percentage),
    date: form.value.days !== (s.max_backdate_days == null ? '' : String(s.max_backdate_days)),
    negotiated: form.value.negotiated !== s.negotiated_discount || [...form.value.roleIds].sort().join() !== [...s.negotiated_role_ids].sort().join(),
  }
})

async function save(card: Card) {
  errors.value = {}
  saving.value = card
  const payload: Partial<OrderSettings> = card === 'strategic' ? { strategic_percentage: Number(form.value.strategic) }
    : card === 'date' ? { max_backdate_days: form.value.days.trim() === '' ? null : Number(form.value.days) }
      : { negotiated_discount: form.value.negotiated, negotiated_role_ids: form.value.roleIds }
  try {
    const settings = await saveOrderSettings(payload)
    reset(settings)
    toast.success(t('studio.list.toast.saved'))
  }
  catch (failure) {
    errors.value = fieldErrors(failure)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(failure) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = null
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-sm text-dl-muted">{{ t('nav.workspaces.orders') }}</span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('orders.settings.title') }}</h1>
      <p class="text-[13px] text-dl-muted">{{ t('orders.settings.subtitle') }}</p>
    </div>
    <DlSkeleton v-if="!saved" class="h-40 rounded-3xl" />
    <template v-else>
      <form class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" @submit.prevent="save('strategic')">
        <strong class="text-sm">{{ t('orders.settings.strategic') }}</strong>
        <div class="w-56">
          <DlInput v-model="form.strategic" inputmode="numeric" :label="t('orders.settings.strategicField')" :disabled="!canEdit" :error="errors.strategic_percentage">
            <template #end><span class="pe-3 text-dl-muted">%</span></template>
          </DlInput>
        </div>
        <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.settings.strategicHint', { value: form.strategic || saved.strategic_percentage }) }}</p>
        <div v-if="canEdit" class="flex justify-end gap-2">
          <DlButton variant="ghost" :disabled="!changed.strategic" @click="reset(saved)">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" variant="dark" :disabled="!changed.strategic" :loading="saving === 'strategic'">{{ t('common.actions.save') }}</DlButton>
        </div>
      </form>

      <form class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" @submit.prevent="save('date')">
        <strong class="text-sm">{{ t('orders.settings.date') }}</strong>
        <div class="w-56">
          <DlInput v-model="form.days" inputmode="numeric" :label="t('orders.settings.daysField')" :placeholder="t('orders.settings.noLimit')" :disabled="!canEdit" :error="errors.max_backdate_days">
            <template #end><span class="pe-3 text-dl-muted">{{ t('orders.settings.days') }}</span></template>
          </DlInput>
        </div>
        <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ form.days.trim() === '' ? t('orders.settings.daysNone') : t('orders.settings.daysHint', { days: form.days }) }}</p>
        <div v-if="canEdit" class="flex justify-end gap-2">
          <DlButton variant="ghost" :disabled="!changed.date" @click="reset(saved)">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" variant="dark" :disabled="!changed.date" :loading="saving === 'date'">{{ t('common.actions.save') }}</DlButton>
        </div>
      </form>

      <form class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" @submit.prevent="save('negotiated')">
        <div class="flex items-center gap-3">
          <strong class="flex-1 text-sm">{{ t('orders.settings.negotiated') }}</strong>
          <DlSwitch v-model="form.negotiated" :label="form.negotiated ? t('orders.settings.on') : t('orders.settings.off')" />
        </div>
        <CheckList
          v-if="form.negotiated"
          v-model="form.roleIds"
          :legend="t('orders.settings.negotiatedRoles')"
          :selected-label="t('orders.settings.rolesCount', form.roleIds.length)"
          :search-label="t('orders.settings.roleSearch')"
          :items="roleItems"
          :empty-text="t('orders.settings.noRoles')"
          :disabled="!canEdit"
          :error="errors.negotiated_role_ids"
        />
        <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.settings.negotiatedHint') }}</p>
        <div v-if="canEdit" class="flex justify-end gap-2">
          <DlButton variant="ghost" :disabled="!changed.negotiated" @click="reset(saved)">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" variant="dark" :disabled="!changed.negotiated" :loading="saving === 'negotiated'">{{ t('common.actions.save') }}</DlButton>
        </div>
      </form>
    </template>
  </div>
</template>
