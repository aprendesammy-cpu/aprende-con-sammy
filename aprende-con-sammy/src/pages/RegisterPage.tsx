import { Link, useNavigate } from 'react-router-dom'

import { AuthPageShell } from '@/components/AuthPageShell'
import { RegisterForm } from '@/components/RegisterForm'

/**
 * Pantalla de alta de usuarios.
 *
 * Solo se puede crear perfil de `padre` o `educador`: el rol `admin` no está
 * en el `<select>` y tampoco existe a nivel de tipos (`PublicRegisterRole`).
 */
function RegisterPage() {
  const navigate = useNavigate()

  return (
    <AuthPageShell
      variant="celebrating"
      title="Crea tu cuenta"
      subtitle="Familias y educadores. La cuenta de administrador la crea otro administrador."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            className="font-bold text-primary-600 underline-offset-4 hover:underline"
          >
            Inicia sesión
          </Link>
        </>
      }
    >
      <RegisterForm onSuccess={() => navigate('/', { replace: true })} />

      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        Al crear tu cuenta aceptas el tratamiento de tus datos según la política de
        privacidad. Los datos de menores se almacenan cifrados y solo son visibles para
        su familia y sus educadores.
      </p>
    </AuthPageShell>
  )
}

export default RegisterPage
