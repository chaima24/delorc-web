<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import DlAvatar from '@/components/DlAvatar.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useUserText } from '../userDisplay'
import OrgSubtree from './OrgSubtree.vue'
import { chainsUp, peopleUnder } from './orgTree'
import { useOrgTree } from './useOrgTree'

// "Reports to": one row per direct manager (any number, all equal), with the people above that
// manager as a short grey line, nearest first. Someone with no manager but people under them is
// shown at the top of their own tree instead. Used on the user page and in the side panel.
const props = defineProps<{ userId: number }>()
const { t, n } = useI18n()
const text = useUserText()
const { tree } = useOrgTree()

const rows = computed(() => (tree.value.managersOf.get(props.userId) ?? []).map(id => ({
  manager: tree.value.byId.get(id)!,
  above: chainsUp(tree.value, id).map(path => [...path].reverse().map(person => tree.value.byId.get(person)?.full_name).filter(Boolean).join(' → ')),
})).filter(row => row.manager))
const self = computed(() => tree.value.byId.get(props.userId) ?? null)
const total = computed(() => peopleUnder(tree.value, props.userId).size)
</script>

<template>
  <!-- No manager, people under them: their own tree -->
  <div v-if="!rows.length && total && self" class="flex flex-col gap-1">
    <span class="flex items-center gap-2 rounded-xl bg-dl-signal-soft px-2 py-1.5 text-[13px] ring-[1.5px] ring-dl-fg ring-inset">
      <DlAvatar :name="self.full_name" :src="self.avatar?.url" size="sm" />
      <span class="flex min-w-0 flex-1 flex-col">
        <strong class="truncate font-semibold">{{ self.full_name }}</strong>
        <span class="truncate text-xs text-dl-muted">{{ t('users.hierarchy.topOf', { count: n(total) }, total) }}</span>
      </span>
    </span>
    <OrgSubtree :user-id="userId" :level="1" :open-levels="3" />
  </div>
  <p v-else-if="!rows.length" class="text-[13px] text-dl-muted">{{ t('users.hierarchy.nobody') }}</p>
  <ul v-else class="flex flex-col divide-y divide-dl-line-soft">
    <li v-for="row in rows" :key="row.manager.id" class="flex gap-2.5 py-2 first:pt-0 last:pb-0">
      <DlAvatar :name="row.manager.full_name" :src="row.manager.avatar?.url" size="sm" />
      <span class="flex min-w-0 flex-col text-[13px]">
        <RouterLink :to="{ name: 'tenant-user-detail', params: { id: row.manager.id } }" class="truncate font-semibold text-dl-fg no-underline hover:underline">
          {{ row.manager.full_name }}
        </RouterLink>
        <span class="truncate text-xs text-dl-muted">{{ text.role(row.manager) }}</span>
        <span v-for="(line, index) in row.above" :key="index" class="mt-0.5 flex items-center gap-1 text-xs text-dl-muted">
          <DlIcon icon="tabler-arrow-up" :size="12" class="shrink-0" />
          <span class="truncate">{{ line }}</span>
        </span>
      </span>
    </li>
  </ul>
</template>
