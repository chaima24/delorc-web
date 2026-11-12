<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TenantUser } from '@/api/tenant/users'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAuthStore } from '@/stores/auth'
import ReportsToList from './hierarchy/ReportsToList.vue'
import { peopleUnder } from './hierarchy/orgTree'
import { useOrgTree } from './hierarchy/useOrgTree'
import { useUserActions } from './useUserActions'
import { STATUS_TONES, accountStatus, currentTerritory, useUserText } from './userDisplay'

// Reading panel: where the person is now (with the cycle running today), contact, rules, sign-in.
// "Open full page" for the rest.
const props = defineProps<{ user: TenantUser }>()
const emit = defineEmits<{ changed: []; changeManager: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useUserText()
const auth = useAuthStore()
const { tree } = useOrgTree()

// Hierarchy: the chain up to the top, and who is under this person.
const direct = computed(() => (tree.value.childrenOf.get(props.user.id) ?? []).map(id => tree.value.byId.get(id)!).filter(Boolean))
const allUnder = computed(() => peopleUnder(tree.value, props.user.id).size)

const actions = useUserActions(toRef(props, 'user'), { onChange: () => emit('changed') })

const status = computed(() => accountStatus(props.user))
const tiles = computed(() => [
  { label: t('users.columns.team'), value: text.teams(props.user) },
  { label: t('users.columns.manager'), value: text.managers(props.user) },
  { label: t('users.columns.territory'), value: currentTerritory(props.user)?.name ?? '—' },
  { label: t('users.read.cycle'), value: text.range(props.user.active_cycle?.start_date, props.user.active_cycle?.end_date) },
])
const commune = computed(() => [props.user.commune?.name, props.user.commune?.wilaya?.name].filter(Boolean).join(', ') || '—')
const signIn = computed(() => {
  if (status.value === 'active') return t('users.read.signedIn', { date: text.dateTime(props.user.last_login_at) })
  if (status.value === 'invited') return t('users.read.linkValidUntil', { date: text.dateTime(props.user.access_link_expires_at) })
  if (status.value === 'not_invited') return t('users.read.notInvited')
  return t('users.read.inactive')
})
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="user.full_name">
    <template #media>
      <DlAvatar :name="user.full_name" :src="user.avatar?.url" size="lg" :tone="status === 'inactive' ? 'neutral' : 'cobalt'" />
    </template>
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge size="sm">{{ text.role(user) }}</DlBadge>
        <DlBadge size="sm" dot :tone="STATUS_TONES[status]">{{ text.status(user) }}</DlBadge>
      </span>
    </template>
    <template v-if="actions.menuItems.value.length" #actions>
      <DlMenu :label="t('fieldSetup.menu.label')" :items="actions.menuItems.value" always-menu />
    </template>

    <div class="flex flex-col gap-3.5">
      <p v-if="status === 'invited' || status === 'not_invited'" class="rounded-2xl bg-dl-cobalt/8 px-3.5 py-2.5 text-[13px]">
        {{ signIn }}
        <button v-if="auth.can('users.send-access')" type="button" class="font-semibold text-dl-cobalt hover:underline" :disabled="actions.busy.value" @click="actions.sendAccess(user)">
          {{ t(status === 'invited' ? 'users.actions.resendAccess' : 'users.actions.sendAccess') }}
        </button>
      </p>

      <dl class="grid grid-cols-2 gap-2">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ tile.label }}</dt>
          <dd class="truncate text-[13px] font-semibold">{{ tile.value }}</dd>
        </div>
      </dl>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('users.read.contact') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('users.fields.email') }}</dt><dd class="break-all">{{ user.email }}</dd>
          <dt class="text-dl-muted">{{ t('users.fields.phone') }}</dt><dd>{{ user.phone || '—' }}</dd>
          <dt class="text-dl-muted">{{ t('users.fields.commune') }}</dt><dd>{{ commune }}</dd>
          <dt class="text-dl-muted">{{ t('users.fields.language') }}</dt><dd>{{ user.language?.name ?? '—' }}</dd>
        </dl>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('users.read.rules') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('users.rules.planning') }}</dt><dd>{{ user.planning_rule?.name ?? t('users.rules.none') }}</dd>
          <dt class="text-dl-muted">{{ t('users.rules.validation') }}</dt><dd>{{ user.validation_rule?.name ?? t('users.rules.none') }}</dd>
        </dl>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-2 text-sm font-semibold">{{ t('users.hierarchy.reportsTo') }}</h3>
        <ReportsToList :user-id="user.id" />
        <h3 class="mb-1 mt-3 text-sm font-semibold">{{ t('users.assign.manages') }}</h3>
        <p class="text-[13px] text-dl-body">
          {{ direct.length ? t('users.hierarchy.managesCount', { direct: n(direct.length), all: n(allUnder) }) : t('users.assign.managesNobody', { name: user.first_name }) }}
        </p>
        <ul v-if="direct.length" class="mt-2 flex flex-wrap gap-1.5">
          <li v-for="person in direct.slice(0, 6)" :key="person.id" class="rounded-full border border-dl-line px-2.5 py-1 text-xs font-semibold">{{ person.full_name }}</li>
          <li v-if="direct.length > 6" class="rounded-full border border-dl-line px-2.5 py-1 text-xs font-semibold">＋ {{ n(direct.length - 6) }}</li>
        </ul>
      </section>

      <section v-if="status === 'active' || status === 'inactive'" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1 text-sm font-semibold">{{ t('users.read.signIn') }}</h3>
        <p class="text-[13px] text-dl-body">{{ signIn }}</p>
      </section>
    </div>

    <template #footer>
      <DlButton v-if="auth.can('users.update')" variant="outline" class="flex-1" @click="emit('changeManager')">{{ t('users.hierarchy.change') }}</DlButton>
      <DlButton variant="dark" icon-end="tabler-arrow-up-right" class="flex-1" :to="{ name: 'tenant-user-detail', params: { id: user.id } }">
        {{ t('users.read.openFullPage') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>
