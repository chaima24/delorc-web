<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchPromoLines, type PromoLine } from '@/api/tenant/campaigns'
import DlIcon from '@/components/DlIcon.vue'

// The promo grid in a visit, read only: for the person's team(s) that day and the doctor's main speciality, the brands
// to present in priority order, with their message. Shows nothing when no campaign ticks it. Mockup frame 9.
const props = defineProps<{ userId: number | null | undefined; date: string | null | undefined; hcpId: number | null | undefined }>()
const { t } = useI18n()

const lines = ref<PromoLine[]>([])
const query = computed(() => (props.userId && props.date && props.hcpId ? { user_id: props.userId, date: props.date, hcp_id: props.hcpId } : null))
let asked = 0
watch(query, async value => {
  const current = ++asked
  if (!value) {
    lines.value = []
    return
  }
  try {
    const rows = await fetchPromoLines(value)
    if (current === asked) lines.value = rows
  }
  catch {
    if (current === asked) lines.value = []
  }
}, { immediate: true, deep: true })

const campaigns = computed(() => [...new Map(lines.value.map(line => [line.campaign.id, line.campaign])).values()])
</script>

<template>
  <section v-if="lines.length" class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('campaigns.promo.title')">
    <header class="flex items-center gap-2.5">
      <span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-dl-line-soft text-dl-body"><DlIcon icon="tabler-speakerphone" :size="17" /></span>
      <h3 class="flex-1 text-sm font-semibold">{{ t('campaigns.promo.title') }}</h3>
    </header>
    <div v-for="campaign in campaigns" :key="campaign.id" class="flex flex-col gap-2">
      <span class="text-xs text-dl-muted">{{ t('campaigns.promo.campaign', { code: campaign.code, name: campaign.name }) }}</span>
      <div v-for="line in lines.filter(row => row.campaign.id === campaign.id)" :key="`${line.team.id}-${line.brand.id}`" class="flex items-start gap-3 rounded-xl bg-dl-mist px-3 py-2.5">
        <span class="inline-flex h-6 min-w-[34px] shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-extrabold text-white" :style="{ background: line.priority?.color ?? 'var(--color-dl-ink)' }">{{ line.priority?.name ?? '—' }}</span>
        <div class="min-w-0 text-[13px]">
          <strong class="block">{{ line.brand.name }}</strong>
          <span v-if="line.message" class="text-dl-body">« {{ line.message }} »</span>
        </div>
      </div>
    </div>
    <p class="text-xs text-dl-muted">{{ t('campaigns.promo.hint') }}</p>
  </section>
</template>
