import { Link } from 'react-router-dom'

import { SammyMascot } from '@/components/SammyMascot'
import { Button } from '@/components/ui/Button'
import { useOptionalAuth } from '@/hooks/useAuth'

/**
 * Ruta inexistente.
 *
 * Se muestra también cuando un usuario intenta entrar directamente a una ruta
 * que no le corresponde, en vez de una pantalla en blanco.
 */
function NotFoundPage() {
  const auth = useOptionalAuth()

  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 py-14">
      <div className="w-full max-w-md text-center">
        <SammyMascot variant="sitting" size={150} className="mx-auto" />

        <p className="mt-5 text-5xl font-black text-primary-400">404</p>
        <h1 className="mt-2 text-2xl font-extrabold text-navy-700">
          Esta página se fue de recreo
        </h1>
        <p className="mt-2 text-sm text-muted">
          La dirección que intentaste abrir no existe o ya no está disponible.
        </p>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          {auth?.isAuthenticated ? (
            <Link to="/">
              <Button variant="primary" fullWidth>
                Volver al inicio
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button variant="primary" fullWidth>
                Iniciar sesión
              </Button>
            </Link>
          )}
          <Link to="/register">
            <Button variant="outline" fullWidth>
              Crear cuenta
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}

export default NotFoundPage
