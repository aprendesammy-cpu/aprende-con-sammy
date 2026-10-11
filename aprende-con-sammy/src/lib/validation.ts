/**
 * ============================================================
 *  Validación de formularios (capa de cliente)
 * ============================================================
 *  Reglas idénticas a las de `src/lib/auth.ts`, pero aplicadas campo a campo
 *  para dar feedback inmediato sin consumir red. La validación del servidor
 *  sigue siendo la autoritativa: esto es UX, no seguridad.
 */

import { isValidEmail, MIN_PASSWORD_LENGTH, normalizeEmail } from '@/lib/utils'
import type { LoginData, RegisterFormValues } from '@/types'

/** Mapa de errores por campo. Ausente = campo válido. */
export type FieldErrors<T> = Partial<Record<keyof T, string>>

/** Tonos reutilizables para la barra de fuerza de contraseña. */
export type StrengthTone = 'danger' | 'sun' | 'creative' | 'success'

/** Resultado de la evaluación de una contraseña. */
export interface PasswordStrength {
  /** Puntuación de 0 (nula) a 4 (excelente). */
  score: number
  /** Etiqueta legible. */
  label: string
  /** Tono recomendado para la barra de progreso. */
  tone: StrengthTone
}

const STRENGTH_LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'] as const
const STRENGTH_TONES: StrengthTone[] = ['danger', 'danger', 'sun', 'creative', 'success']

/**
 * Evalúa la robustez de una contraseña.
 *
 * @param password Contraseña en crudo.
 * @returns Puntuación, etiqueta y tono.
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  const value = password ?? ''
  let score = 0

  if (value.length >= MIN_PASSWORD_LENGTH) score += 1
  if (value.length >= 12) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1

  // Sin contenido no hay puntuación mínima; con contenido, al menos 1.
  const normalized = value.length === 0 ? 0 : Math.min(Math.max(score, 1), 4)

  return {
    score: normalized,
    label: STRENGTH_LABELS[normalized] ?? STRENGTH_LABELS[0]!,
    tone: STRENGTH_TONES[normalized] ?? 'danger',
  }
}

/**
 * Valida el formulario de registro campo a campo.
 *
 * @param data Valores actuales del formulario.
 * @returns Errores por campo; objeto vacío si todo es válido.
 */
export function validateRegisterForm(
  data: RegisterFormValues,
): FieldErrors<RegisterFormValues> {
  const errors: FieldErrors<RegisterFormValues> = {}
  const fullName = (data.fullName ?? '').trim()
  const normalizedEmail = normalizeEmail(data.email ?? '')
  const password = data.password ?? ''
  const sala = (data.sala ?? '').trim()

  if (!fullName) {
    errors.fullName = 'Escribe tu nombre completo.'
  } else if (fullName.length < 3) {
    errors.fullName = 'El nombre es demasiado corto.'
  } else if (!/\s/.test(fullName)) {
    errors.fullName = 'Incluye nombre y apellido.'
  }

  if (!normalizedEmail) {
    errors.email = 'Escribe tu email.'
  } else if (!isValidEmail(normalizedEmail)) {
    errors.email = 'El email no tiene un formato válido.'
  }

  if (!password) {
    errors.password = 'Escribe una contraseña.'
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }

  if (!data.role) {
    errors.role = 'Selecciona tu rol.'
  }

  if (data.role === 'educador' && !sala) {
    errors.sala = 'Indica la sala que lideras.'
  }

  return errors
}

/**
 * Valida el formulario de inicio de sesión.
 *
 * @param data Email y contraseña.
 * @returns Errores por campo; objeto vacío si todo es válido.
 */
export function validateLoginForm(data: LoginData): FieldErrors<LoginData> {
  const errors: FieldErrors<LoginData> = {}
  const normalizedEmail = normalizeEmail(data.email ?? '')

  if (!normalizedEmail) {
    errors.email = 'Escribe tu email.'
  } else if (!isValidEmail(normalizedEmail)) {
    errors.email = 'El email no tiene un formato válido.'
  }

  if (!data.password) {
    errors.password = 'Escribe tu contraseña.'
  }

  return errors
}

/**
 * Valida un email suelto (recuperación de contraseña).
 *
 * @param email Email en crudo.
 * @returns Mensaje de error o `null` si es válido.
 */
export function validateEmailField(email: string): string | null {
  const normalizedEmail = normalizeEmail(email ?? '')
  if (!normalizedEmail) return 'Escribe tu email.'
  if (!isValidEmail(normalizedEmail)) return 'El email no tiene un formato válido.'
  return null
}

/**
 * Determina si un mapa de errores está vacío.
 *
 * @param errors Errores por campo.
 */
export function hasErrors(errors: Record<string, unknown>): boolean {
  return Object.keys(errors).length > 0
}

/**
 * Devuelve la clave del primer campo con error, para mover ahí el foco.
 *
 * @param errors Errores por campo.
 * @param order Orden visual de los campos en el formulario.
 */
export function firstErrorKey<T extends object>(
  errors: FieldErrors<T>,
  order: (keyof T)[],
): keyof T | null {
  for (const key of order) {
    if (errors[key]) {
      return key
    }
  }
  return null
}
