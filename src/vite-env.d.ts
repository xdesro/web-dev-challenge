/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_LOCAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}