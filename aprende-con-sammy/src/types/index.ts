import type { User as SupabaseAuthUser } from '@supabase/supabase-js'

/**
 * ============================================================
 *  APRENDE CON SAMMY — Contrato de tipos del dominio
 * ============================================================
 *  Fuente de verdad única para Auth + tabla `public.users`.
 *
 *  REGLAS NO NEGOCIABLES:
 *   1. La tabla SIEMPRE se llama `users`. NUNCA `profiles`.
 *   2. Variables de entorno con prefijo VITE_ leídas vía import.meta.env.
 *   3. El email SIEMPRE se normaliza: email.toLowerCase().trim()
 *
 *  Ver ADR-002 y ADR-003 en DOCS/decisiones-arquitectura.md
 */

/** Roles de la plataforma (ADR-003). */
export type UserRole = 'padre' | 'educador' | 'admin'

/** Roles asignables desde el registro público. `admin` queda excluido por tipos. */
export type PublicRegisterRole = Exclude<UserRole, 'admin'>

/** Etiqueta legible de cada rol para la UI. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  padre: 'Padre / Madre',
  educador: 'Educador',
  admin: 'Administrador',
}

/**
 * Roles ofrecidos en el formulario de registro.
 * `admin` se asigna únicamente por SQL o desde Gestión de Usuarios.
 */
export const PUBLIC_REGISTER_ROLES: PublicRegisterRole[] = ['padre', 'educador']

/**
 * Registro de la tabla `public.users`.
 * Refleja 1:1 las columnas creadas por el script SQL maestro (Paso 6).
 */
export interface User {
  /** PK — referencia a auth.users(id) */
  id: string
  /** Email normalizado (lowercase + trim), único */
  email: string
  /** Nombre corto / de pila */
  name: string | null
  /** Nombre completo tal como lo ingresó el usuario */
  full_name: string | null
  /** Rol dentro de la plataforma */
  role: UserRole
  /** Sala que lidera — obligatoria cuando role === 'educador' (ADR-004) */
  sala: string | null
  created_at: string
  updated_at: string
}

/**
 * DTO que produce una fila de `public.users`.
 * Permite omitir campos gestionados por la base de datos
 * (timestamps, y `id` cuando la crea el trigger `handle_new_auth_user`).
 */
export type UserInsert = Omit<User, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<User, 'id' | 'created_at' | 'updated_at'>>

/** Subconjunto de columnas actualizables (admin / upserts). */
export type UserUpdate = Partial<
  Pick<User, 'email' | 'name' | 'full_name' | 'role' | 'sala' | 'updated_at'>
>

/** Datos mínimos que viajan en `raw_user_meta_data` al hacer signUp. */
export interface UserMetadata {
  name: string
  full_name: string
  role: UserRole
  sala?: string | null
}

/** Usuario de sesión devuelto por Supabase Auth. */
export type AuthUser = SupabaseAuthUser

/** Payload del formulario de registro. */
export interface RegisterData {
  /** Nombre completo (obligatorio) */
  fullName: string
  /** Email — SIEMPRE se normaliza: email.toLowerCase().trim() */
  email: string
  /** Contraseña (mínimo 8 caracteres) */
  password: string
  /** Rol seleccionado: padre | educador */
  role: PublicRegisterRole
  /** Sala que lideras — obligatoria solo si role === 'educador' */
  sala?: string
}

/**
 * Valores del formulario de registro.
 * `role` admite cadena vacía porque el `<select>` arranca sin selección;
 * `sala` siempre es cadena (no `undefined`) para controlled inputs.
 */
export interface RegisterFormValues {
  fullName: string
  email: string
  password: string
  role: PublicRegisterRole | ''
  sala: string
}

/**
 * Guarda de tipo para el rol seleccionable en el registro.
 * Evita conversiones `as` al construir el `RegisterData`.
 *
 * @param value Valor proveniente del `<select>`.
 */
export function isPublicRegisterRole(value: string): value is PublicRegisterRole {
  return (PUBLIC_REGISTER_ROLES as string[]).includes(value)
}

/** Payload del formulario de login. */
export interface LoginData {
  /** Email — SIEMPRE se normaliza: email.toLowerCase().trim() */
  email: string
  password: string
}

/** Resultado uniforme de cualquier operación de autenticación. */
export interface AuthResult {
  /** true si la operación terminó sin errores */
  success: boolean
  /** Mensaje legible, en español, para mostrar en la UI */
  message: string
  /** Usuario de sesión, cuando existe */
  user?: AuthUser | null
  /** Fila de public.users, cuando existe */
  profile?: User | null
  /**
   * true cuando el registro quedó pendiente de confirmación por email.
   * La UI debe mostrar un aviso en lugar de redirigir al Dashboard.
   */
  requiresConfirmation?: boolean
}

/** Errores conocidos mapeados a mensajes en español. */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'email_invalid'
  | 'weak_password'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'network'
  | 'config'
  | 'unknown'

/**
 * Resultado uniforme de cualquier operación de datos (no autenticación).
 * Mismo contrato que `AuthResult` para que la UI trate ambos por igual.
 */
export interface DataResult<T = void> {
  success: boolean
  message: string
  data?: T | null
}

/**
 * Datos para crear un usuario desde el panel de administración.
 * A diferencia de `RegisterData`, aquí SÍ puede asignarse el rol `admin`.
 *
 * La creación real la ejecuta una Edge Function con clave `service_role`;
 * ver `supabase/functions/admin-create-user/index.ts`.
 */
export interface AdminCreateUserData {
  /** Email — SIEMPRE se normaliza: email.toLowerCase().trim() */
  email: string
  password: string
  fullName: string
  role: UserRole
  /** Sala que lidera — obligatoria solo si role === 'educador' */
  sala?: string
}

/** Perfil + sesión juntos, para consumo del hook useAuth (Paso 3). */
export interface AuthState {
  user: AuthUser | null
  profile: User | null
  loading: boolean
  isAuthenticated: boolean
  role: UserRole | null
}
