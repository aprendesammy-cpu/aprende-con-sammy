import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  getCurrentUser,
  getUserProfile,
  loginUser,
  logoutUser,
  registerUser,
} from '@/lib/auth'
import type {
  AuthResult,
  AuthState,
  AuthUser,
  LoginData,
  RegisterData,
  User,
  UserRole,
} from '@/types'

/**
 * ============================================================
 *  ESTADO GLOBAL DE AUTENTICACIÓN — Aprende con Sammy
 * ============================================================
 *  Un único `AuthProvider` en la raíz de la aplicación. Expone sesión,
 *  perfil de `public.users`, acciones y estado derivado.
 *
 *  Problemas que este diseño resuelve explícitamente:
 *   1. Bucle infinito → `onAuthStateChange` se dispara al montar y ante
 *      cualquier cambio; el perfil solo se sincroniza si cambia `user.id`.
 *   2. Doble montaje por `<StrictMode>` → limpieza con bandera `cancelled`
 *      y `unsubscribe`, más un ref que deduplica peticiones en vuelo.
 *   3. Carrera INITIAL_SESSION → SIGNED_IN con el mismo id → mismo ref.
 *   4. Spinner infinito sin `.env.local` → `configError` se DERIVA en el render
 *      (no es estado) y `loading` arranca en `false` si falta configuración.
 *      Se añade además un límite de espera por si `onAuthStateChange` no emitiera.
 *   5. Pérdida de sesión por un fallo transitorio de red al leer el perfil →
 *      NO se cierra la sesión; se expone `profileError` con opción de reintento.
 */

/** Aviso mostrado cuando faltan las variables de entorno de Supabase. */
const CONFIG_ERROR_MESSAGE =
  'La aplicación no está configurada: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.'

/** Límite de espera del primer evento de sesión, en milisegundos. */
const INITIAL_SESSION_TIMEOUT_MS = 10_000

/** Contexto completo consumido por `useAuth()`. */
export interface AuthContextValue extends AuthState {
  /** Registrar un usuario nuevo (valida, normaliza y persiste en `users`). */
  register: (data: RegisterData) => Promise<AuthResult>
  /** Iniciar sesión con email y contraseña. */
  login: (data: LoginData) => Promise<AuthResult>
  /** Cerrar la sesión activa. */
  logout: () => Promise<AuthResult>
  /** Volver a leer el perfil de `public.users` (tras una edición o un fallo). */
  refreshProfile: () => Promise<boolean>
  /** Error de configuración del cliente Supabase, si lo hubiera. */
  configError: string | null
  /** Error al cargar el perfil, si lo hubiera. La sesión sigue activa. */
  profileError: string | null
  /** Indica si el perfil activo tiene el rol indicado. */
  hasRole: (role: UserRole) => boolean
}

/** Contexto de autenticación. `null` fuera del provider. */
const AuthContext = createContext<AuthContextValue | null>(null)
AuthContext.displayName = 'AuthContext'

/** Props del provider. */
export interface AuthProviderProps {
  children: ReactNode
}

/**
 * Envuelve la aplicación y mantiene el estado de sesión sincronizado
 * con Supabase Auth y con la tabla `public.users`.
 *
 * @param props Hijos del provider.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  // Si falta configuración no tiene sentido esperar una sesión: se arranca en
  // `false` para no dejar la UI bloqueada en un spinner permanente.
  const [loading, setLoading] = useState<boolean>(() => isSupabaseConfigured())
  const [profileError, setProfileError] = useState<string | null>(null)

  /**
   * Error de configuración DERIVADO, no estado: se calcula una sola vez y evita
   * un `setState` síncrono dentro del efecto (cascading renders).
   */
  const configError = useMemo<string | null>(
    () => (isSupabaseConfigured() ? null : CONFIG_ERROR_MESSAGE),
    [],
  )

  /**
   * Identificador del perfil que se está sincronizando.
   * Evita peticiones duplicadas por doble montaje o eventos redundantes.
   */
  const syncingProfileId = useRef<string | null>(null)

  /**
   * Sincroniza el perfil de `public.users` para una sesión dada.
   *
   * @param authUser Usuario de sesión, o `null` para limpiar el estado.
   * @param force Fuerza la lectura aunque ya se haya sincronizado ese id.
   */
  const syncProfile = useCallback(
    async (authUser: AuthUser | null, force = false): Promise<void> => {
      if (!authUser) {
        syncingProfileId.current = null
        setUser(null)
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        return
      }

      const isRedundant = syncingProfileId.current === authUser.id && !force
      if (isRedundant) {
        return
      }
      syncingProfileId.current = authUser.id

      setUser(authUser)
      setLoading(true)
      setProfileError(null)

      const fetched = await getUserProfile(authUser.id)

      // Otra sesión tomó el control mientras se resolvía la petición.
      if (syncingProfileId.current !== authUser.id) {
        return
      }

      if (!fetched) {
        console.error(
          `[AuthProvider] No se pudo cargar el perfil de public.users para ${authUser.id}.`,
        )
        setProfile(null)
        setProfileError(
          'No pudimos cargar tu perfil. Verifica tu conexión e inténtalo de nuevo.',
        )
      } else {
        setProfile(fetched)
      }

      setLoading(false)
    },
    [],
  )

  /** Suscripción única a los cambios de estado de Supabase Auth. */
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    try {
      if (!supabase) {
        throw new Error(CONFIG_ERROR_MESSAGE)
      }

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (cancelled) {
          return
        }
        // Un cambio de evento no debe dejar el spinner activo si no hay sesión.
        void syncProfile(session?.user ?? null)
      })

      unsubscribe = () => data.subscription.unsubscribe()
    } catch (error) {
      console.error('[AuthProvider] No se pudo inicializar la autenticación:', error)
    }

    // Red de seguridad: si `onAuthStateChange` nunca emite el primer evento
    // (proxy corporativo, extensión que bloquea, backend caído), la UI no puede
    // quedarse en un spinner infinito.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false)
      }
    }, INITIAL_SESSION_TIMEOUT_MS)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      if (unsubscribe) {
        unsubscribe()
      }
      syncingProfileId.current = null
    }
  }, [syncProfile])

  /**
   * Registra un usuario nuevo.
   *
   * @param data Datos del formulario de registro.
   */
  const register = useCallback(async (data: RegisterData): Promise<AuthResult> => {
    try {
      const result = await registerUser(data)

      if (!result.success) {
        return result
      }

      // Con confirmación de email no hay sesión: nada que sincronizar.
      if (result.requiresConfirmation || !result.user) {
        return result
      }

      syncingProfileId.current = null
      await syncProfile(result.user, true)
      return result
    } catch (error) {
      console.error('[AuthProvider:register] Excepción inesperada:', error)
      return {
        success: false,
        message: 'No pudimos crear tu cuenta. Inténtalo de nuevo en unos momentos.',
      }
    }
  }, [syncProfile])

  /**
   * Inicia sesión con email y contraseña.
   *
   * @param data Email y contraseña. El email se normaliza en la capa `lib`.
   */
  const login = useCallback(async (data: LoginData): Promise<AuthResult> => {
    try {
      const result = await loginUser(data)

      if (!result.success || !result.user) {
        return result
      }

      syncingProfileId.current = null
      await syncProfile(result.user, true)

      // `loginUser` ya valida el perfil; si no existe, la sesión no es usable.
      if (!result.profile) {
        return {
          success: false,
          message:
            'Iniciaste sesión, pero no encontramos tu perfil. Contacta al administrador.',
        }
      }

      return result
    } catch (error) {
      console.error('[AuthProvider:login] Excepción inesperada:', error)
      return {
        success: false,
        message: 'No pudimos iniciar sesión. Inténtalo de nuevo en unos momentos.',
      }
    }
  }, [syncProfile])

  /** Cierra la sesión activa y limpia el estado local. */
  const logout = useCallback(async (): Promise<AuthResult> => {
    try {
      const result = await logoutUser()

      // Se limpia el estado incluso si Supabase devolvió un error: la sesión
      // local ya no es utilizable y dejarla expuesta sería un riesgo.
      syncingProfileId.current = null
      setUser(null)
      setProfile(null)
      setProfileError(null)
      setLoading(false)

      return result
    } catch (error) {
      console.error('[AuthProvider:logout] Excepción inesperada:', error)
      syncingProfileId.current = null
      setUser(null)
      setProfile(null)
      setLoading(false)
      return {
        success: false,
        message: 'No pudimos cerrar la sesión correctamente. Recarga la página.',
      }
    }
  }, [])

  /**
   * Relee el perfil de `public.users`.
   *
   * @returns `true` si el perfil se cargó correctamente.
   */
  const refreshProfile = useCallback(async (): Promise<boolean> => {
    try {
      const currentUser = user ?? (await getCurrentUser())
      if (!currentUser) {
        return false
      }
      syncingProfileId.current = null
      await syncProfile(currentUser, true)
      return profileError === null
    } catch (error) {
      console.error('[AuthProvider:refreshProfile] Excepción inesperada:', error)
      return false
    }
  }, [user, profileError, syncProfile])

  /**
   * Comprueba si el perfil activo tiene un rol concreto.
   *
   * @param role Rol a verificar.
   */
  const hasRole = useCallback(
    (role: UserRole): boolean => profile?.role === role,
    [profile],
  )

  /** Estado derivado. */
  const isAuthenticated = user !== null && profile !== null
  const role: UserRole | null = profile?.role ?? null

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isAuthenticated,
      role,
      configError,
      profileError,
      register,
      login,
      logout,
      refreshProfile,
      hasRole,
    }),
    [
      user,
      profile,
      loading,
      isAuthenticated,
      role,
      configError,
      profileError,
      register,
      login,
      logout,
      refreshProfile,
      hasRole,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Accede al contexto de autenticación.
 *
 * @throws Error si se usa fuera de `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      '[useAuth] Este hook debe usarse dentro de <AuthProvider>. ' +
        'Envuelve tu árbol de componentes en src/main.tsx.',
    )
  }

  return context
}

/**
 * Variante que devuelve `null` en lugar de lanzar.
 * Útil en componentes opcionales (por ejemplo, la navbar pública).
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}

/**
 * Expone únicamente el estado, sin las acciones.
 * Reduce re-renders en componentes de solo lectura.
 */
export function useAuthState(): AuthState {
  const { user, profile, loading, isAuthenticated, role } = useAuth()
  return useMemo(
    () => ({ user, profile, loading, isAuthenticated, role }),
    [user, profile, loading, isAuthenticated, role],
  )
}
