<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UncoveredPerson } from '@/api/tenant/objectives'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

// People of field roles with no objective today nor later: they can't get a cycle.
// One "Add" per role opens "Add objective" for that role and all teams.
const props = defineProps<{ people: UncoveredPerson[] }>()
const emit = defineEmits<{ add: [roleId: number] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)

const byRole = computed(() => {
  const groups = new Map<number, { roleId: number; role: string; people: UncoveredPerson[] }>()
  for (const person of props.people) {
    if (!person.role) continue
    const group = groups.get(person.role.id) ?? { roleId: person.role.id, role: roleLabel(person.role.name), people: [] }
    group.people.push(person)
    groups.set(person.role.id, group)
  }
  return [...groups.values()].sort((a, b) => a.role.localeCompare(b.role))
})
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('objectives.uncovered.title')" :description="t('objectives.uncovered.description')">
    <p v-if="!people.length" class="text-[13px] text-dl-body">{{ t('objectives.uncovered.none') }}</p>
    <div v-else class="flex flex-col gap-3.5 text-[13px]">
      <section v-for="group in byRole" :key="group.roleId" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-2 text-sm font-semibold">{{ group.role }}</h3>
        <ul class="flex flex-col gap-2">
          <li v-for="person in group.people" :key="person.id" class="flex items-center gap-2.5">
            <DlAvatar :name="person.full_name" size="sm" />
            <span class="flex min-w-0 flex-col">
              <strong class="truncate font-semibold">{{ person.full_name }}</strong>
              <span class="text-xs text-dl-muted">{{ person.team?.name ?? t('objectives.uncovered.noTeam') }}</span>
            </span>
          </li>
        </ul>
        <DlButton v-if="canStore('objectives')" variant="dark" size="sm" icon="tabler-plus" class="mt-3" @click="emit('add', group.roleId)">
          {{ t('objectives.uncovered.add', { role: group.role }) }}
        </DlButton>
      </section>
    </div>
  </DlRecordPanel>
</template>
