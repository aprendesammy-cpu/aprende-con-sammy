import { AuthError } from '@supabase/supabase-js'

import { requireSupabase } from '@/lib/supabase'
import {
  getFirstName,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  normalizeName,
  truncateText,
  MAX_TEXT_LENGTH,
} from '@/lib/utils'
import type {
  AuthResult,
  AuthUser,
  LoginData,
  RegisterData,
  User,
  UserMetadata,
  UserRole,
} from '@/types'

/**
 * ============================================================
 *  LÓGICA DE AUTENTICACIÓN — Aprende con Sammy
 * ============================================================
 *  REGLAS APLICADAS EN TODAS LAS FUNCIONES:
 *   1. La tabla es SIEMPRE `users` (nunca `profiles`).
 *   3. El email se normaliza SIEMPRE: `email.toLowerCase().trim()`.
 *   4. `try/catch` + validación explícita del `error` de Supabase.
 *   5. Sin `console.log`; solo `console.error` para fallos reales.
 *
 *  Contrato de salida uniforme: `AuthResult { success, message, ... }`.
 *  La UI nunca interpreta errores de Supabase: aquí se traducen a español.
 */

/** Nombre de la tabla. Centralizado para evitar desvíos de la Regla 1. */
const USERS_TABLE = 'users' as const

/**
 * Mensajes legibles por código de error normalizado.
 * `satisfies Record<string, string>` conserva las claves literales: con
 * `noUncheckedIndexedAccess` activado, un `Record<string, string>` convertiría
 * cada acceso en `string | undefined` y obligaría a validaciones redundantes.
 */
const ERROR_MESSAGES = {
  invalid_credentials: 'Email o contraseña incorrectos. Inténtalo de nuevo.',
  email_taken: 'Este email ya tiene una cuenta. Inicia sesión o recupera tu contraseña.',
  email_invalid: 'El email no tiene un formato válido.',
  weak_password: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  email_not_confirmed:
    'Tu email aún no está confirmado. Revisa tu bandeja de entrada y la carpeta de spam.',
  rate_limited:
    'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.',
  network: 'No pudimos conectar con el servidor. Revisa tu conexión a internet.',
  config: 'La aplicación no está configurada correctamente. Contacta al administrador.',
  unknown: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos momentos.',
  session_missing: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  profile_unavailable:
    'Iniciaste sesión, pero no pudimos cargar tu perfil. Cierra sesión y vuelve a intentarlo.',
} satisfies Record<string, string>

/** Cadenas de error de Supabase que indican rate limiting. */
const RATE_LIMIT_HINTS = ['rate limit', 'too many requests', '429']

/**
 * Traduce cualquier fallo a un mensaje en español y a un código estable.
 *
 * @param error Error capturado (AuthError, Error o valor desconocido).
 * @param context Etiqueta de la operación, para el log técnico.
 */
function resolveAuthError(
  error: unknown,
  context: string,
): { code: string; message: string } {
  // Fallo real: se registra con console.error (Regla 5).
  console.error(
    `[auth:${context}]`,
    error instanceof Error ? error.message : error,
  )

  if (error instanceof AuthError) {
    const raw = `${error.code ?? ''} ${error.message}`.toLowerCase()

    if (RATE_LIMIT_HINTS.some((hint) => raw.includes(hint))) {
      return { code: 'rate_limited', message: ERROR_MESSAGES.rate_limited }
    }
    if (raw.includes('invalid login credentials') || raw.includes('invalid_credentials')) {
      return { code: 'invalid_credentials', message: ERROR_MESSAGES.invalid_credentials }
    }
    if (
      raw.includes('already registered') ||
      raw.includes('user already registered') ||
      raw.includes('email_exists')
    ) {
      return { code: 'email_taken', message: ERROR_MESSAGES.email_taken }
    }
    if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) {
      return { code: 'email_not_confirmed', message: ERROR_MESSAGES.email_not_confirmed }
    }
    if (
      raw.includes('password') &&
      (raw.includes('short') || raw.includes('weak') || raw.includes('should be at least'))
    ) {
      return { code: 'weak_password', message: ERROR_MESSAGES.weak_password }
    }
    if (raw.includes('unable to validate email') || raw.includes('invalid email')) {
      return { code: 'email_invalid', message: ERROR_MESSAGES.email_invalid }
    }

    // Error conocido de Supabase pero sin traducción específica: se muestra tal cual.
    return { code: error.code ?? 'unknown', message: error.message }
  }

  if (error instanceof TypeError) {
    // `fetch` lanza TypeError ante cortes de red o CORS.
    return { code: 'network', message: ERROR_MESSAGES.network }
  }

  if (error instanceof Error && error.message.includes('[Supabase]')) {
    return { code: 'config', message: ERROR_MESSAGES.config }
  }

  return { code: 'unknown', message: ERROR_MESSAGES.unknown }
}

/**
 * Construye un `AuthResult` de error.
 *
 * @param message Mensaje para el usuario.
 * @param extra Campos adicionales del resultado.
 */
function failure(
  message: string,
  extra: Partial<AuthResult> = {},
): AuthResult {
  return { success: false, message, ...extra }
}

/**
 * Construye un `AuthResult` de éxito.
 *
 * @param message Mensaje para el usuario.
 * @param extra Campos adicionales del resultado.
 */
function success(message: string, extra: Partial<AuthResult> = {}): AuthResult {
  return { success: true, message, ...extra }
}

/**
 * Valida y normaliza el payload de registro.
 *
 * @param data Datos crudos del formulario.
 * @returns `ok: false` con el mensaje a mostrar, o `ok: true` con datos limpios.
 */
function validateRegisterData(data: RegisterData):
  | { ok: false; message: string }
  | {
      ok: true
      value: {
        normalizedEmail: string
        fullName: string
        firstName: string
        password: string
        role: RegisterData['role']
        sala: string | null
      }
    } {
  // REGLA 3 — normalización obligatoria antes de cualquier operación.
  const normalizedEmail = normalizeEmail(data.email)
  const fullName = truncateText(data.fullName ?? '', MAX_TEXT_LENGTH)
  const password = data.password ?? ''
  const sala =
    data.role === 'educador'
      ? truncateText(data.sala ?? '', MAX_TEXT_LENGTH)
      : null

  if (!fullName) {
    return { ok: false, message: 'Escribe tu nombre completo.' }
  }
  if (!normalizedEmail) {
    return { ok: false, message: 'Escribe tu email.' }
  }
  if (!isValidEmail(normalizedEmail)) {
    return { ok: false, message: ERROR_MESSAGES.email_invalid }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: ERROR_MESSAGES.weak_password }
  }
  if (data.role === 'educador' && !sala) {
    return { ok: false, message: 'Indica la sala que lideras.' }
  }

  return {
    ok: true,
    value: {
      normalizedEmail,
      fullName,
      firstName: getFirstName(fullName),
      password,
      role: data.role,
      sala,
    },
  }
}

/**
 * Inserta o actualiza la fila del usuario en `public.users`.
 *
 * Es un refuerzo defensivo: el trigger `handle_new_auth_user` ya crea la fila
 * al registrarse, pero si el trigger falla o está ausente, la cuenta seguiría
 * existiendo en `auth.users` sin perfil y la app quedaría inutilizable.
 *
 * Un fallo aquí NUNCA aborta el registro: se registra con `console.error` y
 * el flujo continúa, porque la sesión ya es válida.
 *
 * @param userId Identificador del usuario en `auth.users`.
 * @param row Datos de la fila a persistir.
 * @returns La fila persistida, o `null` si el upsert no pudo realizarse.
 */
async function upsertUserProfile(
  userId: string,
  row: Omit<User, 'id' | 'created_at' | 'updated_at'>,
): Promise<User | null> {
  try {
    const { data, error } = await requireSupabase()
      .from(USERS_TABLE)
      .upsert({ ...row, id: userId }, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) {
      // RLS o trigger ya resolvieron el alta: no es un fallo del usuario.
      console.error(
        '[auth:upsertUserProfile] El upsert en public.users devolvió un error:',
        error.message,
      )
      return null
    }

    return data as User
  } catch (error) {
    console.error('[auth:upsertUserProfile] Excepción inesperada:', error)
    return null
  }
}

/**
 * Registra un usuario nuevo.
 *
 * Flujo:
 *  1. Valida y normaliza (email en minúsculas y sin espacios).
 *  2. `supabase.auth.signUp` con `raw_user_meta_data` (dispara el trigger de BD).
 *  3. `upsert` defensivo en `public.users`.
 *  4. Devuelve un `AuthResult` con mensaje en español.
 *
 * @param data Nombre completo, email, contraseña, rol y sala (si educador).
 */
export async function registerUser(data: RegisterData): Promise<AuthResult> {
  const validation = validateRegisterData(data)
  if (!validation.ok) {
    return failure(validation.message)
  }

  const { normalizedEmail, fullName, firstName, password, role, sala } =
    validation.value

  try {
    const metadata: UserMetadata = {
      name: firstName,
      full_name: fullName,
      role,
      ...(sala !== null ? { sala } : {}),
    }

    const { data: signUpData, error } = await requireSupabase().auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: metadata,
        emailRedirectTo:
          typeof window === 'undefined' ? undefined : window.location.origin,
      },
    })

    if (error) {
      const resolved = resolveAuthError(error, 'registerUser')
      return failure(resolved.message)
    }

    const authUser = signUpData.user

    if (!authUser) {
      return failure(ERROR_MESSAGES.unknown)
    }

    // Confirmación de email activada: no hay sesión hasta que el usuario valide.
    if (!signUpData.session) {
      return success(
        '¡Cuenta creada! Revisa tu email para confirmar la cuenta antes de iniciar sesión.',
        { user: authUser, profile: null, requiresConfirmation: true },
      )
    }

    const profile = await upsertUserProfile(authUser.id, {
      email: normalizedEmail,
      name: firstName,
      full_name: fullName,
      role,
      sala,
    })

    return success('¡Cuenta creada con éxito! Bienvenido a Aprende con Sammy.', {
      user: authUser,
      profile,
      requiresConfirmation: false,
    })
  } catch (error) {
    const resolved = resolveAuthError(error, 'registerUser')
    return failure(resolved.message)
  }
}

/**
 * Inicia sesión con email y contraseña.
 *
 * @param data Email y contraseña. El email se normaliza siempre.
 */
export async function loginUser(data: LoginData): Promise<AuthResult> {
  // REGLA 3 — normalización obligatoria antes de cualquier operación.
  const normalizedEmail = normalizeEmail(data.email ?? '')
  const password = data.password ?? ''

  if (!normalizedEmail) {
    return failure('Escribe tu email.')
  }
  if (!isValidEmail(normalizedEmail)) {
    return failure(ERROR_MESSAGES.email_invalid)
  }
  if (!password) {
    return failure('Escribe tu contraseña.')
  }

  try {
    const { data: signInData, error } = await requireSupabase().auth.signInWithPassword(
      { email: normalizedEmail, password },
    )

    if (error) {
      const resolved = resolveAuthError(error, 'loginUser')
      return failure(resolved.message)
    }

    if (!signInData?.user) {
      return failure(ERROR_MESSAGES.unknown)
    }

    const profile = await getUserProfile(signInData.user.id)

    if (!profile) {
      // Sesión válida pero sin fila en `public.users`: se informa sin bloquear el log.
      console.error(
        `[auth:loginUser] Sesión activa para ${signInData.user.id} sin perfil en public.users.`,
      )
      return failure(ERROR_MESSAGES.profile_unavailable, {
        user: signInData.user,
        profile: null,
      })
    }

    return success(`¡Hola de nuevo, ${profile.name ?? profile.full_name ?? 'bienvenido'}!`, {
      user: signInData.user,
      profile,
    })
  } catch (error) {
    const resolved = resolveAuthError(error, 'loginUser')
    return failure(resolved.message)
  }
}

/**
 * Cierra la sesión actual en todos los dispositivos vinculados al token.
 */
export async function logoutUser(): Promise<AuthResult> {
  try {
    const { error } = await requireSupabase().auth.signOut()

    if (error) {
      const resolved = resolveAuthError(error, 'logoutUser')
      return failure(resolved.message)
    }

    return success('Sesión cerrada correctamente.')
  } catch (error) {
    const resolved = resolveAuthError(error, 'logoutUser')
    return failure(resolved.message)
  }
}

/**
 * Obtiene el usuario de la sesión vigente, si existe.
 *
 * `getSession()` lee la caché local; `getUser()` la valida contra el servidor,
 * evitando operar con un token revocado.
 *
 * @returns El usuario autenticado o `null`.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const client = requireSupabase()

    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    if (sessionError) {
      console.error('[auth:getCurrentUser] Error al leer la sesión:', sessionError.message)
      return null
    }
    if (!sessionData.session) {
      return null
    }

    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError) {
      console.error('[auth:getCurrentUser] Error al validar el usuario:', userError.message)
      return null
    }

    return userData.user ?? null
  } catch (error) {
    console.error('[auth:getCurrentUser] Excepción inesperada:', error)
    return null
  }
}

/**
 * Obtiene el perfil de `public.users` para un usuario dado.
 *
 * @param userId Identificador de `auth.users`.
 * @returns La fila del usuario o `null` si no existe / no es legible.
 */
export async function getUserProfile(userId: string): Promise<User | null> {
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await requireSupabase()
      .from(USERS_TABLE)
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[auth:getUserProfile] Error al leer public.users:', error.message)
      return null
    }

    return (data as User | null) ?? null
  } catch (error) {
    console.error('[auth:getUserProfile] Excepción inesperada:', error)
    return null
  }
}

/**
 * Envía el correo de recuperación de contraseña.
 *
 * Devuelve éxito aunque el email no exista, para no revelar qué cuentas
 * están registradas (enumeración de usuarios).
 *
 * @param email Email del usuario. Se normaliza siempre.
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  // REGLA 3 — normalización obligatoria antes de cualquier operación.
  const normalizedEmail = normalizeEmail(email ?? '')

  if (!normalizedEmail) {
    return failure('Escribe tu email.')
  }
  if (!isValidEmail(normalizedEmail)) {
    return failure(ERROR_MESSAGES.email_invalid)
  }

  try {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: typeof window === 'undefined' ? undefined : `${window.location.origin}/login`,
    })

    if (error) {
      const resolved = resolveAuthError(error, 'resetPassword')
      return failure(resolved.message)
    }

    return success(
      `Si existe una cuenta para ${normalizedEmail}, recibirás un enlace para restablecer tu contraseña.`,
    )
  } catch (error) {
    const resolved = resolveAuthError(error, 'resetPassword')
    return failure(resolved.message)
  }
}

/**
 * Extrae el rol del usuario desde los metadatos del JWT.
 * Útil para decisiones rápidas antes de tener el perfil de BD.
 *
 * @param user Usuario de sesión de Supabase.
 * @returns El rol si es válido, o `null`.
 */
export function getRoleFromUser(user: AuthUser | null): UserRole | null {
  const candidate = user?.user_metadata?.role
  const validRoles: UserRole[] = ['padre', 'educador', 'admin']
  return typeof candidate === 'string' && validRoles.includes(candidate as UserRole)
    ? (candidate as UserRole)
    : null
}

/**
 * Nombre para mostrar en saludos y cabeceras.
 *
 * @param profile Perfil de `public.users`.
 * @param fallback Texto alternativo si no hay nombre registrado.
 */
export function getDisplayName(profile: User | null, fallback = 'Familia Sammy'): string {
  if (!profile) return fallback
  return normalizeName(profile.name ?? profile.full_name ?? '') || fallback
}

/**
 * Comprueba si el perfil activo tiene rol de administrador.
 *
 * @param profile Perfil de `public.users`.
 */
export function isAdmin(profile: User | null): boolean {
  return profile?.role === 'admin'
}

/**
 * Comprueba si el perfil activo tiene rol de educador.
 *
 * @param profile Perfil de `public.users`.
 */
export function isEducator(profile: User | null): boolean {
  return profile?.role === 'educador'
}
