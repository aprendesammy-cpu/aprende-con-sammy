/**
 * Utilidades de navegación para leer el estado pasado entre rutas.
 *
 * `location.state` es `any` en React Router: aquí se valida defensivamente
 * en lugar de confiar en él, porque puede venir de un marcador, de un
 * historial antiguo o de otra pestaña.
 */

/** Estado esperado al entrar en una ruta. */
export interface RouteState {
  /** Destino original antes de la redirección al login. */
  from: string
  /** Mensaje de denegación por rol, si la guarda redirigió aquí. */
  deniedMessage: string | null
}

/**
 * Interpreta el estado de una ubicación de forma segura.
 *
 * @param state Valor crudo de `location.state`.
 * @returns Estado normalizado, con valores por defecto seguros.
 */
export function readRouteState(state: unknown): RouteState {
  const fallback: RouteState = { from: '/', deniedMessage: null }

  if (typeof state !== 'object' || state === null) {
    return fallback
  }

  const record = state as Record<string, unknown>

  const from =
    typeof record.from === 'string' && record.from.startsWith('/') ? record.from : '/'

  const deniedMessage =
    typeof record.message === 'string' && record.message.length > 0 ? record.message : null

  return { from, deniedMessage }
}

/**
 * Saludo según la hora local del usuario.
 *
 * @param now Momento a evaluar (inyectable para hacerlo testeable).
 */
export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours()
  if (hour < 6) return 'Buenas noches'
  if (hour < 13) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
