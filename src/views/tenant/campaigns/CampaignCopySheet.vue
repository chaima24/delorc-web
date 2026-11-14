<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { copyGrid, fetchCampaigns, previewCopy, type Campaign, type CampaignGrid, type CopyPreview } from '@/api/tenant/campaigns'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'

// "Copier la grille de…": pick another campaign, see what will be copied (and skipped), then copy. The ticks of the
// teams both campaigns share are replaced. Mockup frame 6.
const props = defineProps<{ campaign: Campaign }>()
const emit = defineEmits<{ copied: [grid: CampaignGrid] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const toast = useToast()

const campaigns = ref<Campaign[]>([])
fetchCampaigns({ page: 1, per_page: 100, sort: '-start_date' }).then(result => { campaigns.value = result.items.filter(row => row.id !== props.campaign.id) })
const options = computed(() => campaigns.value.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` })))

const fromId = ref<number | null>(null)
const preview = ref<CopyPreview | null>(null)
const error = ref('')
const loading = ref(false)
watch(fromId, async id => {
  preview.value = null
  error.value = ''
  if (id == null) return
  loading.value = true
  try {
    preview.value = await previewCopy(props.campaign.id, Number(id))
  }
  catch (failure) {
    error.value = fieldErrors(failure).from_campaign_id ?? errorMessage(failure) ?? t('studio.list.toast.failed')
  }
  finally {
    loading.value = false
  }
})

const saving = ref(false)
async function copy() {
  if (fromId.value == null) return
  saving.value = true
  try {
    const grid = await copyGrid(props.campaign.id, Number(fromId.value))
    toast.success(t('campaigns.copy.done', grid.copied))
    emit('copied', grid)
    open.value = false
  }
  catch (failure) {
    toast.error(errorMessage(failure) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlSheet v-model:open="open" :title="t('campaigns.copy.title')" :description="t('campaigns.copy.description', { name: campaign.name })">
    <div class="flex flex-col gap-4">
      <DlCombobox v-model="fromId" :label="t('campaigns.copy.from')" :placeholder="t('campaigns.copy.pick')" :options="options" :error="error" />
      <DlSkeleton v-if="loading" class="h-24 rounded-2xl" />
      <template v-else-if="preview">
        <div class="flex flex-wrap items-center gap-1.5 text-[13px]">
          {{ t('campaigns.copy.shared') }}
          <DlBadge v-for="team in preview.teams" :key="team.id" size="sm">{{ team.name }}</DlBadge>
        </div>
        <p class="rounded-xl bg-dl-mist px-3.5 py-3 text-[13px]">
          {{ t('campaigns.copy.summary', { copied: n(preview.copied), replaced: n(preview.replaced) }) }}
        </p>
        <div v-if="preview.skipped.length" class="flex flex-col gap-1 rounded-xl bg-dl-rejected/8 px-3.5 py-3 text-[13px] text-dl-rejected">
          <strong>{{ t('campaigns.copy.skipped', preview.skipped.length) }}</strong>
          <span v-for="(row, i) in preview.skipped" :key="i">{{ t(`campaigns.copy.why.${row.why}`, row) }}</span>
        </div>
      </template>
    </div>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="primary" class="ms-auto" :disabled="!preview || !preview.copied" :loading="saving" @click="copy">{{ t('campaigns.copy.confirm', preview?.copied ?? 0) }}</DlButton>
    </template>
  </DlSheet>
</template>
