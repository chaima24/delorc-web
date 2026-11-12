<script setup lang="ts">
import { tokenHex } from '@/views/tenant/consents/tokenColor'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// Draw a signature with a finger or a mouse. The model is a PNG data URL, or null while empty.
defineProps<{ label: string }>()
const model = defineModel<string | null>({ default: null })
const { t } = useI18n()

const canvas = ref<HTMLCanvasElement | null>(null)
let drawing = false
let last: { x: number; y: number } | null = null

function context() {
  return canvas.value?.getContext('2d') ?? null
}
onMounted(() => {
  const el = canvas.value
  if (!el) return
  // Sharp on high-density screens.
  const ratio = window.devicePixelRatio || 1
  el.width = el.offsetWidth * ratio
  el.height = el.offsetHeight * ratio
  const ctx = context()
  ctx?.scale(ratio, ratio)
})
function point(event: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}
function start(event: PointerEvent) {
  drawing = true
  last = point(event)
  canvas.value?.setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  const ctx = context()
  if (!drawing || !ctx || !last) return
  const next = point(event)
  ctx.strokeStyle = tokenHex('ink')
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(last.x, last.y)
  ctx.lineTo(next.x, next.y)
  ctx.stroke()
  last = next
}
function end() {
  if (!drawing) return
  drawing = false
  last = null
  model.value = canvas.value?.toDataURL('image/png') ?? null
}
function clear() {
  const el = canvas.value
  context()?.clearRect(0, 0, el?.width ?? 0, el?.height ?? 0)
  model.value = null
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <span class="text-[13px] font-semibold">{{ label }}</span>
      <button v-if="model" type="button" class="text-xs font-semibold text-dl-muted hover:underline" @click="clear">{{ t('consents.page.clearSignature') }}</button>
    </div>
    <canvas
      ref="canvas"
      class="h-32 w-full touch-none rounded-xl border border-dashed border-dl-line bg-white"
      :aria-label="label"
      role="img"
      @pointerdown.prevent="start"
      @pointermove.prevent="move"
      @pointerup="end"
      @pointerleave="end"
      @pointercancel="end"
    />
  </div>
</template>
