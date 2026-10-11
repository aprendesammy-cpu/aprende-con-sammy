import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * ============================================================
 *  Cliente de Supabase (única instancia para toda la app)
 * ============================================================
 *  REGLA ESTRICTA 2: las variables de entorno se leen SIEMPRE con
 *  `import.meta.env` y llevan SIEMPRE el prefijo `VITE_`.
 *  Prohibido `NEXT_PUBLIC_*` y `process.env`.
 *
 *  La ANON KEY es pública por diseño: la seguridad real la garantizan
 *  las políticas RLS de la tabla `public.users` (Paso 6).
 */

/** Nombre de las variables requeridas, para mensajes de error accionables. */
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number]

/**
 * Lee y valida las variables de entorno obligatorias.
 *
 * @throws Error con la lista exacta de variables ausentes.
 * @returns URL y anon key ya recortadas.
 */
function getRequiredEnv(): { url: string; anonKey: string } {
  // El encadenamiento opcional sobre `import.meta.env` es deliberado: fuera del
  // bundler de Vite (Node, SSR, tests) `env` no existe y sin él se filtraría un
  // TypeError críptico en lugar del mensaje accionable de abajo.
  const url = import.meta.env?.VITE_SUPABASE_URL?.trim() ?? ''
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

  const missing: RequiredEnvVar[] = []
  if (!url) missing.push('VITE_SUPABASE_URL')
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY')

  if (missing.length > 0) {
    throw new Error(
      `[Supabase] Faltan variables de entorno obligatorias: ${missing.join(', ')}. ` +
        'Copia .env.example a .env.local (desarrollo) o configúralas en ' +
        'Vercel → Settings → Environment Variables para Production, Preview y Development.',
    )
  }

  return { url, anonKey }
}

/**
 * Indica si la configuración de Supabase está presente.
 * Permite a la UI degradar con un aviso en lugar de reventar en el render.
 */
export function isSupabaseConfigured(): boolean {
  try {
    getRequiredEnv()
    return true
  } catch {
    return false
  }
}

/**
 * Crea el cliente con opciones explícitas de sesión y persistencia.
 *
 * @param url URL del proyecto Supabase.
 * @param anonKey Clave pública del proyecto.
 */
function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      // La sesión sobrevive a recargas del navegador (localStorage).
      persistSession: true,
      // Refresco silencioso del access token antes de que caduque.
      autoRefreshToken: true,
      // Necesario para el enlace de confirmación de email y recuperación
      // de contraseña: procesa el token incluido en la URL.
      detectSessionInUrl: true,
      storageKey: 'aprende-con-sammy.auth',
    },
    global: {
      headers: {
        'X-Client-Info': 'aprende-con-sammy-web',
      },
    },
  })
}

let client: SupabaseClient | null = null

/**
 * Obtiene la instancia singleton del cliente de Supabase.
 *
 * @throws Error si faltan las variables de entorno (mensaje accionable).
 */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = getRequiredEnv()
    client = createSupabaseClient(url, anonKey)
  }
  return client
}

/**
 * Instancia lista para importar directamente (`import { supabase } from '@/lib/supabase'`).
 *
 * Se construye de forma tolerante: si aún no hay `.env.local`, se registra el fallo
 * con `console.error` (Regla 5: nunca `console.log`) y se expone `null` para que la
 * UI muestre el aviso de configuración en vez de una pantalla en blanco.
 */
export const supabase: SupabaseClient | null = (() => {
  try {
    return getSupabaseClient()
  } catch (error) {
    console.error(
      '[Supabase] No se pudo inicializar el cliente:',
      error instanceof Error ? error.message : error,
    )
    return null
  }
})()

/**
 * Acceso estricto al cliente: lanza si no está configurado.
 * Úsalo en funciones de `lib/` donde la operación no tiene sentido sin backend.
 */
export function requireSupabase(): SupabaseClient {
  const instance = supabase ?? getSupabaseClient()
  if (!instance) {
    throw new Error(
      '[Supabase] El cliente no está disponible. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
    )
  }
  return instance
}
