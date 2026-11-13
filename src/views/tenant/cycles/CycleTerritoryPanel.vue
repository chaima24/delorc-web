<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addCycleProfessionals, fetchTerritoryCheck, type CycleDetail, type TerritoryCheck } from '@/api/tenant/cycles'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useCycleText } from './cycleDisplay'

// "Check territory": who joined the person's territory since the cycle was made (add them), and who
// is in the cycle but no longer in the territory (they stay; the manager decides).
const props = defineProps<{ cycle: CycleDetail }>()
const emit = defineEmits<{ added: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useCycleText()
const toast = useToast()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)

const check = ref<TerritoryCheck | null>(null)
async function load() {
  check.value = null
  try {
    check.value = await fetchTerritoryCheck(props.cycle.id)
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
watch(() => props.cycle.id, load, { immediate: true })

const saving = ref(false)
async function addJoined() {
  if (!check.value) return
  saving.value = true
  try {
    const body = await addCycleProfessionals(props.cycle.id, { hcp_ids: check.value.joined.map(row => row.id), segmentation_id: null })
    toast.success(t('cycles.add.done', body.added))
    emit('added')
    load()
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('cycles.check.title')" :description="cycle.territory?.name ?? t('cycles.check.noTerritory')">
    <div v-if="!check" class="flex flex-col gap-2"><DlSkeleton v-for="i in 3" :key="i" class="h-14 rounded-xl" /></div>
    <div v-else class="flex flex-col gap-3.5">
      <p v-if="!check.territory_id" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[12.5px] text-dl-pending">{{ t('cycles.check.noTerritoryText') }}</p>
      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('cycles.check.joined', { n: n(check.joined_count) }) }}</h3>
        <p v-if="!check.joined_count" class="text-[13px] text-dl-muted">{{ t('cycles.check.noneJoined') }}</p>
        <ul v-else class="flex flex-col text-[13px]">
          <li v-for="row in check.joined" :key="row.id" class="border-b border-dl-line-soft py-1.5">
            <strong class="font-semibold">{{ row.name }}</strong> <small class="text-xs text-dl-muted">· {{ [text.kind(row.type), row.commune].filter(Boolean).join(' · ') }}</small>
          </li>
        </ul>
        <DlButton v-if="check.joined_count && canUpdate('cycles')" variant="dark" size="sm" class="mt-2.5" :loading="saving" @click="addJoined">{{ t('cycles.check.addJoined', check.joined.length) }}</DlButton>
      </section>
      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('cycles.check.left', { n: n(check.left_count) }) }}</h3>
        <p v-if="!check.left_count" class="text-[13px] text-dl-muted">{{ t('cycles.check.noneLeft') }}</p>
        <template v-else>
          <ul class="flex flex-col text-[13px]">
            <li v-for="row in check.left" :key="row.id" class="border-b border-dl-line-soft py-1.5">
              <strong class="font-semibold">{{ row.name }}</strong> <small class="text-xs text-dl-muted">· {{ [text.kind(row.type), row.commune].filter(Boolean).join(' · ') }}</small>
            </li>
          </ul>
          <p class="mt-2 text-xs text-dl-muted">{{ t('cycles.check.leftHint') }}</p>
        </template>
      </section>
    </div>
  </DlRecordPanel>
</template>
