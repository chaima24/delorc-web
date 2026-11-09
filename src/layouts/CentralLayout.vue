<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import DlLogo from '@/components/DlLogo.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useAttentionStore } from '@/stores/attention'
import CentralTopBar from './central/CentralTopBar.vue'
import { centralMenu } from './central/centralMenu'

const { t } = useI18n()
const route = useRoute()
const menu = computed(() => centralMenu())

onMounted(() => useAttentionStore().start())
</script>

<template>
  <div class="flex min-h-screen bg-dl-mist font-sans text-dl-fg">
    <nav :aria-label="t('central.menu.label')" class="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-5 bg-dl-ink px-4 py-[18px] md:flex">
      <DlLogo :size="40" wordmark on-dark />
      <ul class="flex flex-col gap-1.5">
        <li v-for="item in menu" :key="item.to">
          <RouterLink
            :to="{ name: item.to }"
            class="flex h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-semibold no-underline"
            :class="item.pages.includes(String(route.name)) ? 'bg-dl-signal text-dl-ink' : 'text-dl-on-ink-muted hover:bg-dl-ink-2'"
          >
            <DlIcon :icon="item.icon" :size="20" />
            {{ t(item.label) }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <div class="flex min-w-0 flex-1 flex-col">
      <CentralTopBar />
      <main class="flex-1 px-4 py-5 md:px-7">
        <RouterView />
      </main>
    </div>
  </div>
</template>
