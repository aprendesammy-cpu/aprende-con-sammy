/// <reference types="vite/client" />

/**
 * Tipado fuerte de las variables de entorno expuestas por Vite.
 * Todas usan el prefijo obligatorio VITE_ (nunca NEXT_PUBLIC_ ni process.env).
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_ENV?: 'development' | 'preview' | 'production'
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
