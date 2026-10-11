/**
 * ============================================================
 *  Utilidades puras compartidas
 * ============================================================
 */

/** Expresión regular pragmática de validación de email. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/** Longitud mínima de contraseña exigida por la aplicación. */
export const MIN_PASSWORD_LENGTH = 8

/** Longitud máxima admitida para nombres y salas (coherente con la BD). */
export const MAX_TEXT_LENGTH = 180

/**
 * REGLA ESTRICTA 3 — Normalización obligatoria del email.
 * Debe aplicarse ANTES de cualquier operación de auth o de base de datos.
 *
 * @param email Email crudo proveniente de un input.
 * @returns Email en minúsculas y sin espacios en los extremos.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Valida la forma de un email ya normalizado.
 *
 * @param normalizedEmail Email pasado por `normalizeEmail`.
 */
export function isValidEmail(normalizedEmail: string): boolean {
  return EMAIL_PATTERN.test(normalizedEmail)
}

/**
 * Normaliza un nombre: colapsa espacios múltiples y recorta extremos.
 *
 * @param value Texto crudo del input.
 */
export function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Extrae el nombre de pila de un nombre completo.
 *
 * @param fullName Nombre completo normalizado.
 */
export function getFirstName(fullName: string): string {
  const [first = ''] = normalizeName(fullName).split(' ')
  return first
}

/**
 * Recorta un texto a una longitud máxima sin cortar palabras a mitad.
 *
 * @param value Texto a recortar.
 * @param maxLength Longitud máxima permitida.
 */
export function truncateText(value: string, maxLength: number): string {
  const normalized = normalizeName(value)
  return normalized.length <= maxLength
    ? normalized
    : normalized.slice(0, maxLength).trimEnd()
}

/**
 * Determina si un valor es un objeto no nulo (narrowing de `unknown`).
 *
 * @param value Valor capturado en un `catch`.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
