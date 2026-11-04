/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CENTRAL_DOMAIN: string
  readonly VITE_API_PORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
