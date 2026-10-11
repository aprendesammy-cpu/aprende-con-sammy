import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FullPageLoader } from '@/components/ui/Spinner'
import { SammyMascot } from '@/components/SammyMascot'
import { useAuth } from '@/hooks/useAuth'
import { USER_ROLE_LABELS } from '@/types'
import type { UserRole } from '@/types'

/**
 * ============================================================
 *  Guardia de rutas
 * ============================================================
 *  Orden de comprobación deliberado — cada estado tiene su propia pantalla:
 *    1. `loading`         → spinner a pantalla completa
 *    2. `configError`     → instrucciones para el despliegue (no es culpa del usuario)
 *    3. sin sesión         → redirección a /login conservando el destino original
 *    4. `profileError`    → reintento, SIN cerrar la sesión (ver ADR del Paso 3)
 *    5. rol no permitido   → redirección al panel con aviso
 *    6. todo correcto      → se renderiza el contenido
 */

/** Props de la ruta protegida. */
export interface ProtectedRouteProps {
  /** Roles con acceso. Si se omite, basta con estar autenticado. */
  allowedRoles?: UserRole[]
  /** Ruta alternativa cuando el rol no tiene permiso. */
  fallbackPath?: string
  children: ReactNode
}

/**
 * Protege una ruta exigiendo sesión y, opcionalmente, un rol concreto.
 *
 * @param props Roles permitidos y contenido protegido.
 */
export function ProtectedRoute({
  allowedRoles,
  fallbackPath = '/',
  children,
}: ProtectedRouteProps) {
  const { loading, profile, user, configError, profileError, refreshProfile } = useAuth()
  const location = useLocation()

  // 1) Sesión aún en resolución.
  if (loading) {
    return <FullPageLoader message="Verificando tu sesión…" />
  }

  // 2) Falta configuración de Supabase: error de despliegue, no de usuario.
  if (configError) {
    return (
      <div className="grid min-h-dvh place-items-center px-5 py-12">
        <div className="w-full max-w-md">
          <SammyMascot variant="sitting" size={120} className="mx-auto mb-5" />
          <Alert tone="warning" title="Configuración pendiente">
            {configError}
          </Alert>
          <p className="mt-4 text-sm text-muted">
            Crea un archivo <code className="font-mono text-xs">.env.local</code> a partir de{' '}
            <code className="font-mono text-xs">.env.example</code>, o define las variables en
            Vercel → Settings → Environment Variables.
          </p>
        </div>
      </div>
    )
  }

  // 3) Sin sesión: se conserva el destino para volver tras el login.
  //    OJO: se comprueba SOLO `user`. Usar también `isAuthenticated` haría
  //    inalcanzable el paso 4, porque `isAuthenticated` exige perfil cargado.
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  // 4) Sesión válida pero perfil ilegible. NO se cierra la sesión: un corte de
  //    red transitorio no debe expulsar al usuario.
  if (profileError || !profile) {
    return (
      <div className="grid min-h-dvh place-items-center px-5 py-12">
        <div className="w-full max-w-md text-center">
          <SammyMascot variant="sitting" size={120} className="mx-auto mb-5" />
          <Alert tone="error" title="No pudimos cargar tu perfil">
            {profileError ??
              'Tu cuenta existe en el sistema de autenticación, pero falta su registro en la tabla de usuarios.'}
          </Alert>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="primary" onClick={() => void refreshProfile()}>
              Reintentar
            </Button>
            <Button variant="ghost" onClick={() => void refreshProfile()}>
              Volver a cargar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 5) Rol sin permiso para esta ruta.
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <Navigate
        to={fallbackPath}
        replace
        state={{
          denied: true,
          message: `Esta sección es solo para ${allowedRoles
            .map((item) => USER_ROLE_LABELS[item])
            .join(' o ')}.`,
        }}
      />
    )
  }

  // 6) Acceso concedido.
  return <>{children}</>
}

/** Props de la guardia inversa. */
export interface PublicOnlyRouteProps {
  children: ReactNode
}

/**
 * Impide entrar a /login o /register con la sesión ya iniciada.
 *
 * @param props Contenido público.
 */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { loading, isAuthenticated, configError } = useAuth()

  if (loading && !configError) {
    return <FullPageLoader message="Verificando tu sesión…" />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/**
 * Marca el rol permitido de forma declarativa para rutas de administración.
 *
 * @param role Rol exigido.
 * @param children Contenido protegido.
 */
export function RoleRoute({ role, children }: { role: UserRole; children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[role]} fallbackPath="/">
      {children}
    </ProtectedRoute>
  )
}
