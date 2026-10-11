import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AuthPageShell } from '@/components/AuthPageShell'
import { LoginForm } from '@/components/LoginForm'
import { Alert } from '@/components/ui/Alert'
import { readRouteState } from '@/lib/navigation'

/**
 * Pantalla de inicio de sesión.
 *
 * Tras un acceso correcto devuelve al usuario al destino que pidió antes de
 * ser redirigido (`state.from`), no siempre a la raíz.
 */
function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { from, deniedMessage } = readRouteState(location.state)

  return (
    <AuthPageShell
      variant="waving"
      title="Bienvenido de nuevo"
      subtitle="Entra con el correo que registraste en el centro educativo."
      footer={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link
            to="/register"
            className="font-bold text-primary-600 underline-offset-4 hover:underline"
          >
            Crea tu cuenta
          </Link>
        </>
      }
    >
      {deniedMessage ? (
        <Alert tone="warning" className="mb-5" title="Acceso restringido">
          {deniedMessage}
        </Alert>
      ) : null}

      <LoginForm
        onSuccess={() => navigate(from, { replace: true })}
        footer={
          <p className="text-xs">
            ¿Problemas para entrar? Escribe a{' '}
            <a
              href="mailto:soporte@aprendeconsammy.cl"
              className="font-bold text-primary-600 underline-offset-4 hover:underline"
            >
              soporte@aprendeconsammy.cl
            </a>
          </p>
        }
      />
    </AuthPageShell>
  )
}

export default LoginPage
