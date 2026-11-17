<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { EditorContent, Extension, mergeAttributes, Node, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { MAIL_FIELDS, type MailField } from '@/api/tenant/campaignMessages'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'

/**
 * The text of an email (a small visual editor: Tiptap) or of an SMS (`plain`: text only). A field is a chip in the
 * text and travels as `{{CODE}}`, as the API stores it (docs/api/campaign-messages.md). Images go to the API first
 * (`upload` answers their permanent link). Like a Blade view with `{{ $name }}`: the API fills the codes when it sends.
 * `single`: one line of plain text (a subject), with chips too.
 */
const props = withDefaults(defineProps<{
  label: string
  plain?: boolean
  single?: boolean
  error?: string
  disabled?: boolean
  upload?: (file: File) => Promise<string>
}>(), { plain: false, single: false, error: undefined, upload: undefined })
const model = defineModel<string>({ default: '' })
const { t } = useI18n()

const fieldLabel = (code: string) => t(`campaignMessages.fields.${code}`)
const BUTTON_STYLE = 'display:inline-block;padding:10px 18px;border-radius:10px;background:#1B302C;color:#FFFFFF;text-decoration:none;font-weight:600'

// The chip: an inline atom; `{{CODE}}` inside a span in HTML, the bare code in the SMS text.
const MailFieldNode = Node.create({
  name: 'mailField',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({ code: { default: null, parseHTML: element => element.getAttribute('data-field') } }),
  parseHTML: () => [{ tag: 'span[data-field]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-field': node.attrs.code }), `{{${node.attrs.code}}}`],
  renderText: ({ node }) => `{{${node.attrs.code}}}`,
  addNodeView: () => ({ node }) => {
    const dom = document.createElement('span')
    dom.className = 'dl-mail-field'
    dom.textContent = fieldLabel(String(node.attrs.code))
    return { dom }
  },
})
// A link keeps its style, so "Bouton" is a link drawn as a button (the API keeps `style`, never `javascript:`).
const StyledLink = Link.extend({
  addAttributes() {
    return { ...this.parent?.(), style: { default: null } }
  },
}).configure({ openOnClick: false, protocols: ['mailto'], HTMLAttributes: { target: '_blank', rel: null } })

// One line: Enter adds nothing (no new paragraph, no line break).
const OneLine = Extension.create({
  name: 'oneLine',
  addKeyboardShortcuts: () => ({ 'Enter': () => true, 'Shift-Enter': () => true, 'Mod-Enter': () => true }),
})
const isPlain = computed(() => props.plain || props.single)

/** What the API stores → what the editor reads: bare codes become chips; an SMS's lines become paragraphs. */
function toEditor(value: string): string {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = isPlain.value ? value.split('\n').map(line => `<p>${escape(line)}</p>`).join('') : value
  return html
    .replace(/<span data-field="([A-Z_]+)">\{\{\1\}\}<\/span>/g, '{{$1}}')
    .replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, '<span data-field="$1">{{$1}}</span>')
}
const fromEditor = () => (isPlain.value ? editor.value?.getText({ blockSeparator: '\n' }) ?? '' : editor.value?.isEmpty ? '' : editor.value?.getHTML() ?? '')

const editor = useEditor({
  content: toEditor(model.value),
  editable: !props.disabled,
  extensions: isPlain.value
    ? [StarterKit.configure({ heading: false, bold: false, italic: false, strike: false, underline: false, code: false, codeBlock: false, blockquote: false, bulletList: false, orderedList: false, listItem: false, horizontalRule: false, link: false }), MailFieldNode, ...(props.single ? [OneLine] : [])]
    : [StarterKit.configure({ code: false, codeBlock: false, link: false, heading: { levels: [2, 3] } }), StyledLink, Image, MailFieldNode],
  editorProps: { attributes: { class: props.single ? 'dl-mail-text dl-mail-line' : 'dl-mail-text', 'aria-label': props.label } },
  onUpdate: () => { model.value = fromEditor() },
})
// A new text from outside (the message loaded, a reset): set it without moving the cursor while typing.
watch(model, value => {
  if (editor.value && value !== fromEditor()) editor.value.commands.setContent(toEditor(value), { emitUpdate: false })
})
watch(() => props.disabled, value => editor.value?.setEditable(!value))
onBeforeUnmount(() => editor.value?.destroy())

const chain = () => editor.value!.chain().focus()
const active = (name: string, attrs?: Record<string, unknown>) => !!editor.value?.isActive(name, attrs)
const TOOLS = computed(() => [
  { icon: 'tabler-bold', label: t('campaignMessages.editor.bold'), on: active('bold'), run: () => chain().toggleBold().run() },
  { icon: 'tabler-italic', label: t('campaignMessages.editor.italic'), on: active('italic'), run: () => chain().toggleItalic().run() },
  { icon: 'tabler-underline', label: t('campaignMessages.editor.underline'), on: active('underline'), run: () => chain().toggleUnderline().run() },
  { icon: 'tabler-h-2', label: t('campaignMessages.editor.title'), on: active('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
  { icon: 'tabler-h-3', label: t('campaignMessages.editor.subtitle'), on: active('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
  { icon: 'tabler-list', label: t('campaignMessages.editor.bullets'), on: active('bulletList'), run: () => chain().toggleBulletList().run() },
  { icon: 'tabler-list-numbers', label: t('campaignMessages.editor.numbers'), on: active('orderedList'), run: () => chain().toggleOrderedList().run() },
])
const fieldItems = computed(() => MAIL_FIELDS.map(code => ({ code, label: fieldLabel(code), example: t(`campaignMessages.fields.example.${code}`, { year: new Date().getFullYear() }) })))
function insertField(code: MailField) {
  chain().insertContent({ type: 'mailField', attrs: { code } }).insertContent(' ').run()
}

// Link and button: one small row under the toolbar, instead of the browser's prompt.
const linking = ref<null | 'link' | 'button'>(null)
const href = ref('')
const buttonText = ref('')
function startLink(kind: 'link' | 'button') {
  href.value = (editor.value?.getAttributes('link').href as string | undefined) ?? 'https://'
  buttonText.value = ''
  linking.value = kind
}
function applyLink() {
  const url = href.value.trim()
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return
  if (linking.value === 'button') {
    chain().insertContent({ type: 'text', text: buttonText.value.trim() || url, marks: [{ type: 'link', attrs: { href: url, style: BUTTON_STYLE } }] }).run()
  }
  else if (editor.value?.state.selection.empty) {
    chain().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run()
  }
  else {
    chain().extendMarkRange('link').setLink({ href: url }).run()
  }
  linking.value = null
}

const picker = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
async function addImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file || !props.upload) return
  uploading.value = true
  try {
    const src = await props.upload(file)
    chain().setImage({ src, alt: file.name }).run()
  }
  finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="text-[13px] font-semibold text-dl-fg">{{ label }}</span>
    <div class="flex rounded-2xl border bg-dl-paper" :class="[error ? 'border-dl-rejected' : 'border-dl-line', single ? 'flex-row items-center' : 'flex-col']">
      <div v-if="!disabled" class="flex flex-wrap items-center gap-1" :class="single ? 'order-last shrink-0 p-1.5' : 'border-b border-dl-line-soft p-2'">
        <template v-if="!isPlain">
          <button
            v-for="tool in TOOLS"
            :key="tool.icon"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-dl-body hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            :class="tool.on && 'bg-dl-mist text-dl-fg'"
            :aria-label="tool.label"
            :aria-pressed="tool.on"
            :title="tool.label"
            @click="tool.run"
          ><DlIcon :icon="tool.icon" :size="17" /></button>
          <span class="mx-1 h-5 w-px bg-dl-line" />
          <DlButton size="sm" variant="ghost" icon="tabler-link" @click="startLink('link')">{{ t('campaignMessages.editor.link') }}</DlButton>
          <DlButton v-if="upload" size="sm" variant="ghost" icon="tabler-photo" :loading="uploading" @click="picker?.click()">{{ t('campaignMessages.editor.image') }}</DlButton>
          <DlButton size="sm" variant="ghost" icon="tabler-square-rounded" @click="startLink('button')">{{ t('campaignMessages.editor.button') }}</DlButton>
          <input ref="picker" type="file" accept="image/png,image/jpeg,image/gif" class="hidden" @change="addImage">
        </template>
        <span v-else-if="!single" class="ps-1 text-xs text-dl-muted">{{ t('campaignMessages.editor.plain') }}</span>
        <DropdownMenuRoot>
          <DropdownMenuTrigger class="ms-auto flex h-8 items-center gap-1.5 rounded-lg bg-dl-ink px-3 text-[13px] font-semibold text-dl-on-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt">
            <DlIcon icon="tabler-braces" :size="16" />{{ t('campaignMessages.editor.insertField') }}
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent align="end" :side-offset="6" class="dl-pop z-2100 min-w-[260px] rounded-2xl border border-dl-line bg-dl-paper p-1.5 text-dl-fg shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]">
              <DropdownMenuItem
                v-for="item in fieldItems"
                :key="item.code"
                class="flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-3 text-sm outline-hidden data-highlighted:bg-dl-line-soft"
                @select="insertField(item.code)"
              >
                <span class="dl-mail-field">{{ item.label }}</span>
                <span class="ms-auto text-xs text-dl-muted">{{ item.example }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
      <form v-if="linking" class="flex flex-wrap items-end gap-2 border-b border-dl-line-soft p-2" @submit.prevent="applyLink">
        <div v-if="linking === 'button'" class="w-44"><DlInput v-model="buttonText" :label="t('campaignMessages.editor.buttonText')" /></div>
        <div class="min-w-48 flex-1"><DlInput v-model="href" :label="t('campaignMessages.editor.address')" :hint="t('campaignMessages.editor.addressHint')" /></div>
        <DlButton size="sm" variant="ghost" @click="linking = null">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton size="sm" variant="dark" type="submit">{{ t('campaignMessages.editor.apply') }}</DlButton>
      </form>
      <EditorContent :editor="editor" :class="single ? 'min-w-0 flex-1 px-3.5 py-2' : plain ? 'min-h-28 px-4 py-3' : 'min-h-64 px-4 py-3'" />
    </div>
    <span v-if="error" class="text-xs text-dl-rejected">{{ error }}</span>
  </div>
</template>

<style>
.dl-mail-text { outline: none; font-size: 14.5px; line-height: 1.65; color: var(--color-dl-fg); min-height: inherit; }
.dl-mail-text p { margin: 0 0 10px; }
.dl-mail-line p { margin: 0; }
.dl-mail-line { white-space: nowrap; overflow-x: auto; }
.dl-mail-text h2 { margin: 0 0 10px; font-size: 20px; font-weight: 700; }
.dl-mail-text h3 { margin: 0 0 8px; font-size: 17px; font-weight: 700; }
.dl-mail-text ul { list-style: disc; padding-inline-start: 22px; margin: 0 0 10px; }
.dl-mail-text ol { list-style: decimal; padding-inline-start: 22px; margin: 0 0 10px; }
.dl-mail-text a { color: var(--color-dl-cobalt); text-decoration: underline; }
.dl-mail-text img { max-width: 100%; border-radius: 10px; margin: 4px 0 10px; }
.dl-mail-text img.ProseMirror-selectednode { outline: 2px solid var(--color-dl-cobalt); }
.dl-mail-field { display: inline-flex; align-items: center; gap: 4px; border-radius: 7px; padding: 0 7px; font-size: 13px; font-weight: 700; background: color-mix(in srgb, var(--color-dl-cobalt) 12%, transparent); color: var(--color-dl-cobalt); white-space: nowrap; }
.dl-mail-field::before { content: '◆'; font-size: 9px; }
</style>
