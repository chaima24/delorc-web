/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CENTRAL_DOMAIN: string
  readonly VITE_API_PORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'virtual:tabler-icons' {
  const icons: import('@iconify/vue').IconifyJSON
  export default icons
}
