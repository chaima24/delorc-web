<script setup lang="ts">
import DlConfirmHost from '@/components/DlConfirmHost.vue'
import DlToast from '@/components/DlToast.vue'
</script>

<template>
  <RouterView />
  <DlConfirmHost />
  <DlToast />
</template>
