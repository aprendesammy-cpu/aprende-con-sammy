import { requireSupabase } from '@/lib/supabase'
import {
  MIN_PASSWORD_LENGTH,
  isValidEmail,
  normalizeEmail,
  normalizeName,
  truncateText,
  MAX_TEXT_LENGTH,
  getFirstName,
} from '@/lib/utils'
import type {
  AdminCreateUserData,
  DataResult,
  User,
  UserRole,
} from '@/types'

/**
 * ============================================================
 *  GESTIÓN DE USUARIOS (panel de administración)
 * ============================================================
 *  Tabla: SIEMPRE `users` (Regla 1). Nunca `profiles`.
 *
 *  ⚠️ NOTA DE SEGURIDAD SOBRE `createUserManually`:
 *  Crear una cuenta requiere escribir en `auth.users`, y eso solo puede
 *  hacerse con la clave `service_role`. Esa clave NUNCA debe llegar al
 *  bundle del navegador: quien la lea podría crear, modificar o borrar
 *  cualquier usuario saltándose todas las políticas RLS.
 *
 *  Por eso el alta manual NO usa `supabase.auth.signUp` desde el cliente
 *  (además pisaría la sesión del administrador) sino una **Edge Function**
 *  que conserva `service_role` en sus secretos y verifica que quien invoca
 *  tiene rol `admin` en `public.users`.
 *
 *  Ver `supabase/functions/admin-create-user/index.ts`.
 */

/** Nombre de la tabla. Centralizado para evitar desvíos de la Regla 1. */
const USERS_TABLE = 'users' as const

/** Nombre de la Edge Function que crea cuentas con privilegios. */
const CREATE_USER_FUNCTION = 'admin-create-user'

/** Roles válidos, para validar respuestas del servidor. */
const VALID_ROLES: UserRole[] = ['padre', 'educador', 'admin']

/**
 * Construye un resultado de error.
 *
 * @param message Mensaje legible para el usuario.
 */
function failure<T>(message: string): DataResult<T> {
  return { success: false, message, data: null }
}

/**
 * Construye un resultado de éxito.
 *
 * @param message Mensaje legible para el usuario.
 * @param data Datos devueltos.
 */
function ok<T>(message: string, data: T): DataResult<T> {
  return { success: true, message, data }
}

/**
 * Traduce un fallo a un mensaje en español.
 *
 * @param error Error capturado.
 * @param context Operación, para el registro técnico.
 */
function describeError(error: unknown, context: string): string {
  console.error(`[users:${context}]`, error instanceof Error ? error.message : error)

  if (error instanceof Error) {
    const raw = error.message.toLowerCase()
    if (raw.includes('failed to fetch') || raw.includes('fetch')) {
      return 'No pudimos conectar con el servidor. Revisa tu conexión a internet.'
    }
    if (raw.includes('not found') || raw.includes('404')) {
      return 'La función de administración no está desplegada. Ejecuta `supabase functions deploy admin-create-user`.'
    }
    if (raw.includes('[supabase]')) {
      return 'La aplicación no está configurada correctamente. Contacta al administrador.'
    }
  }

  return 'Ocurrió un error inesperado. Inténtalo de nuevo en unos momentos.'
}

/**
 * Convierte una fila de la base de datos al tipo `User`, validando el rol.
 *
 * @param row Fila cruda devuelta por Supabase.
 * @returns El usuario tipado, o `null` si la fila es inválida.
 */
function toUser(row: unknown): User | null {
  if (typeof row !== 'object' || row === null) {
    return null
  }

  const record = row as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : ''
  const email = typeof record.email === 'string' ? record.email : ''
  const role = record.role

  if (!id || !email || typeof role !== 'string' || !VALID_ROLES.includes(role as UserRole)) {
    return null
  }

  return {
    id,
    email,
    name: typeof record.name === 'string' ? record.name : null,
    full_name: typeof record.full_name === 'string' ? record.full_name : null,
    role: role as UserRole,
    sala: typeof record.sala === 'string' ? record.sala : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : '',
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : '',
  }
}

/**
 * Lista todos los usuarios registrados.
 *
 * @returns Los usuarios ordenados del más reciente al más antiguo.
 */
export async function listUsers(): Promise<DataResult<User[]>> {
  try {
    const { data, error } = await requireSupabase()
      .from(USERS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[users:listUsers]', error.message)
      return failure<User[]>('No pudimos cargar la lista de usuarios.')
    }

    const rows = Array.isArray(data) ? data : []
    const users = rows
      .map((row) => toUser(row))
      .filter((user): user is User => user !== null)

    return ok('Usuarios cargados correctamente.', users)
  } catch (error) {
    return failure<User[]>(describeError(error, 'listUsers'))
  }
}

/**
 * Valida los datos de un alta manual.
 *
 * @param data Datos del formulario de administración.
 * @returns Error de validación o los datos normalizados.
 */
/** Datos de alta manual ya validados y normalizados. */
interface NormalizedAdminCreateData {
  email: string
  fullName: string
  firstName: string
  password: string
  role: UserRole
  sala: string | null
}

function validateAdminCreateData(data: AdminCreateUserData):
  | { error: string }
  | { value: NormalizedAdminCreateData } {
  const normalizedEmail = normalizeEmail(data.email ?? '')
  const fullName = truncateText(normalizeName(data.fullName ?? ''), MAX_TEXT_LENGTH)
  const password = data.password ?? ''
  const role = data.role
  const sala =
    role === 'educador' ? truncateText(normalizeName(data.sala ?? ''), MAX_TEXT_LENGTH) : null

  if (!fullName) return { error: 'Escribe el nombre completo.' }
  if (!normalizedEmail) return { error: 'Escribe el email.' }
  if (!isValidEmail(normalizedEmail)) return { error: 'El email no tiene un formato válido.' }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }
  }
  if (!VALID_ROLES.includes(role)) return { error: 'Selecciona un rol válido.' }
  if (role === 'educador' && !sala) return { error: 'Indica la sala que lidera.' }

  return {
    value: {
      email: normalizedEmail,
      fullName,
      firstName: getFirstName(fullName),
      password,
      role,
      sala,
    },
  }
}

/**
 * Crea un usuario manualmente desde el panel de administración.
 *
 * Delega en la Edge Function `admin-create-user`, que es quien posee la clave
 * `service_role`. La contraseña viaja por HTTPS y nunca se registra.
 *
 * @param data Email, contraseña, nombre completo, rol y sala.
 */
export async function createUserManually(
  data: AdminCreateUserData,
): Promise<DataResult<User>> {
  const validation = validateAdminCreateData(data)
  if ('error' in validation) {
    return failure<User>(validation.error)
  }

  const { email, fullName, firstName, password, role, sala } = validation.value

  try {
    const { data: response, error } = await requireSupabase().functions.invoke(
      CREATE_USER_FUNCTION,
      {
        body: {
          email,
          password,
          full_name: fullName,
          name: firstName,
          role,
          ...(sala !== null ? { sala } : {}),
        },
      },
    )

    if (error) {
      console.error('[users:createUserManually]', error.message)

      const detail =
        typeof response === 'object' && response !== null && 'message' in response
          ? String((response as { message?: unknown }).message ?? '')
          : ''

      if (detail.toLowerCase().includes('already registered')) {
        return failure<User>('Este email ya tiene una cuenta registrada.')
      }
      if (detail.toLowerCase().includes('admin')) {
        return failure<User>('Solo un administrador puede crear usuarios.')
      }
      if (detail) {
        return failure<User>(detail)
      }
      return failure<User>(describeError(error, 'createUserManually'))
    }

    const created = toUser(response)
    if (!created) {
      return failure<User>(
        'La cuenta se creó, pero la respuesta no incluye un usuario válido. Recarga la lista.',
      )
    }

    return ok(`Usuario ${created.email} creado correctamente.`, created)
  } catch (error) {
    return failure<User>(describeError(error, 'createUserManually'))
  }
}

/**
 * Cambia el rol (y la sala) de un usuario existente.
 *
 * @param userId Identificador del usuario.
 * @param role Nuevo rol.
 * @param sala Sala que lidera; obligatoria si el rol pasa a `educador`.
 */
export async function updateUserRole(
  userId: string,
  role: UserRole,
  sala?: string | null,
): Promise<DataResult<User>> {
  if (!userId) return failure<User>('Falta el identificador del usuario.')
  if (!VALID_ROLES.includes(role)) return failure<User>('El rol indicado no es válido.')

  const normalizedSala =
    role === 'educador' ? truncateText(normalizeName(sala ?? ''), MAX_TEXT_LENGTH) : null
  if (role === 'educador' && !normalizedSala) {
    return failure<User>('Indica la sala que lidera.')
  }

  try {
    const { data, error } = await requireSupabase()
      .from(USERS_TABLE)
      .update({ role, sala: normalizedSala })
      .eq('id', userId)
      .select('*')
      .single()

    if (error) {
      console.error('[users:updateUserRole]', error.message)
      return failure<User>('No pudimos actualizar el rol. Verifica tus permisos.')
    }

    const updated = toUser(data)
    if (!updated) {
      return failure<User>('La respuesta del servidor no incluye un usuario válido.')
    }

    return ok('Rol actualizado correctamente.', updated)
  } catch (error) {
    return failure<User>(describeError(error, 'updateUserRole'))
  }
}

/**
 * Elimina la fila de `public.users`.
 *
 * No borra la cuenta de `auth.users`: eso exige `service_role` y corresponde
 * a una Edge Function dedicada. Se deja documentado para no dar la impresión
 * de que el usuario desaparece del sistema de autenticación.
 *
 * @param userId Identificador del usuario.
 */
export async function deleteUser(userId: string): Promise<DataResult<void>> {
  if (!userId) return failure<void>('Falta el identificador del usuario.')

  try {
    const { error } = await requireSupabase().from(USERS_TABLE).delete().eq('id', userId)

    if (error) {
      console.error('[users:deleteUser]', error.message)
      return failure<void>('No pudimos eliminar al usuario. Solo un administrador puede hacerlo.')
    }

    return ok('Usuario eliminado de la lista.', undefined)
  } catch (error) {
    return failure<void>(describeError(error, 'deleteUser'))
  }
}
