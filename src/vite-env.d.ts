/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENHEX_AGENT_ID?: string
  readonly VITE_OPENHEX_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
