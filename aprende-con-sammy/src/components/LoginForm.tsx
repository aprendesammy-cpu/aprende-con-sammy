import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { IconLock, IconMail, IconRefresh } from '@/components/icons'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { resetPassword } from '@/lib/auth'
import { normalizeEmail } from '@/lib/utils'
import {
  firstErrorKey,
  hasErrors,
  validateEmailField,
  validateLoginForm,
  type FieldErrors,
} from '@/lib/validation'
import type { AuthResult, LoginData } from '@/types'

/**
 * ============================================================
 *  Formulario de inicio de sesión
 * ============================================================
 *  Email + contraseña, con recuperación de contraseña integrada en el mismo
 *  componente (panel desplegable) para no obligar a crear una ruta extra.
 */

/** Orden visual de los campos, para mover el foco al primer error. */
const FIELD_ORDER: (keyof LoginData)[] = ['email', 'password']

/** Valores iniciales. */
const INITIAL_VALUES: LoginData = { email: '', password: '' }

/** Props del formulario de acceso. */
export interface LoginFormProps {
  /** Se invoca cuando la sesión se establece correctamente. */
  onSuccess?: (result: AuthResult) => void
  /** Contenido bajo el botón (por ejemplo, el enlace a Crear cuenta). */
  footer?: ReactNode
  className?: string
}

/**
 * Formulario de acceso.
 *
 * @param props Callbacks de éxito y contenido adicional.
 */
export function LoginForm({ onSuccess, footer, className = '' }: LoginFormProps) {
  const { login } = useAuth()

  const [values, setValues] = useState<LoginData>(INITIAL_VALUES)
  const [touched, setTouched] = useState<Partial<Record<keyof LoginData, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)

  // Recuperación de contraseña
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoveryResult, setRecoveryResult] = useState<string | null>(null)
  const [recoverySending, setRecoverySending] = useState(false)

  const fieldRefs = useRef<{ [K in keyof LoginData]?: HTMLElement | null }>({})
  const recoveryInputRef = useRef<HTMLInputElement | null>(null)

  const allErrors = useMemo(() => validateLoginForm(values), [values])

  const visibleErrors = useMemo<FieldErrors<LoginData>>(() => {
    if (submitted) return allErrors
    const filtered: FieldErrors<LoginData> = {}
    for (const key of FIELD_ORDER) {
      if (touched[key] && allErrors[key]) {
        filtered[key] = allErrors[key]
      }
    }
    return filtered
  }, [submitted, allErrors, touched])

  /**
   * Actualiza un campo y limpia el resultado anterior del servidor.
   *
   * @param field Campo a actualizar.
   * @param value Nuevo valor.
   */
  function update(field: keyof LoginData, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }))
    setResult(null)
  }

  /**
   * Envía las credenciales.
   *
   * @param event Evento de envío.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSubmitted(true)
    setResult(null)

    const currentErrors = validateLoginForm(values)
    if (hasErrors(currentErrors)) {
      const firstKey = firstErrorKey(currentErrors, FIELD_ORDER)
      if (firstKey) {
        fieldRefs.current[firstKey]?.focus()
      }
      return
    }

    setSubmitting(true)
    try {
      const authResult = await login({
        email: normalizeEmail(values.email),
        password: values.password,
      })

      setResult(authResult)
      if (authResult.success) {
        onSuccess?.(authResult)
      }
    } catch (error) {
      console.error('[LoginForm] Excepción inesperada al iniciar sesión:', error)
      setResult({
        success: false,
        message: 'No pudimos iniciar sesión. Inténtalo de nuevo en unos momentos.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Abre o cierra el panel de recuperación y prepara el email sugerido.
   */
  function toggleRecovery() {
    const opening = !recoveryOpen
    setRecoveryOpen(opening)
    setRecoveryResult(null)
    setRecoveryError(null)

    if (opening) {
      // Reutiliza el email ya escrito: es lo que el usuario espera.
      setRecoveryEmail(values.email)
      // El foco se mueve tras el pintado del panel.
      requestAnimationFrame(() => recoveryInputRef.current?.focus())
    }
  }

  /**
   * Solicita el enlace de recuperación.
   *
   * No recibe evento a propósito: el panel NO es un `<form>`. Anidar un
   * formulario dentro del principal es HTML inválido —el parser cierra el
   * externo al encontrar el interno— y el envío habría acabado disparando el
   * inicio de sesión en vez de la recuperación.
   */
  async function handleRecovery(): Promise<void> {
    const emailError = validateEmailField(recoveryEmail)
    if (emailError) {
      setRecoveryError(emailError)
      setRecoveryResult(null)
      return
    }

    setRecoveryError(null)
    setRecoverySending(true)
    try {
      const recoveryResponse = await resetPassword(recoveryEmail)
      if (recoveryResponse.success) {
        setRecoveryResult(recoveryResponse.message)
      } else {
        setRecoveryError(recoveryResponse.message)
      }
    } catch (error) {
      console.error('[LoginForm] Excepción inesperada al recuperar la contraseña:', error)
      setRecoveryError('No pudimos enviar el enlace. Inténtalo de nuevo en unos momentos.')
    } finally {
      setRecoverySending(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className={className}>
      {result && !result.success ? (
        <Alert tone="error" className="mb-5" title="No pudimos iniciar sesión">
          {result.message}
        </Alert>
      ) : null}

      {result?.success ? (
        <Alert tone="success" className="mb-5">
          {result.message}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        <Input
          ref={(element) => {
            fieldRefs.current.email = element
          }}
          label="Correo electrónico"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="estudiante@aprendesammy.com"
          required
          icon={<IconMail size={18} />}
          value={values.email}
          error={visibleErrors.email}
          onChange={(event) => update('email', event.target.value)}
          onBlur={(event) => {
            update('email', normalizeEmail(event.target.value))
            setTouched((previous) => ({ ...previous, email: true }))
          }}
        />

        <Input
          ref={(element) => {
            fieldRefs.current.password = element
          }}
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          required
          icon={<IconLock size={18} />}
          value={values.password}
          error={visibleErrors.password}
          onChange={(event) => update('password', event.target.value)}
          onBlur={() => setTouched((previous) => ({ ...previous, password: true }))}
        />

        <div className="-mt-1 flex justify-end">
          <button
            type="button"
            onClick={toggleRecovery}
            aria-expanded={recoveryOpen}
            aria-controls="panel-recuperacion"
            className="min-h-9 rounded-lg px-2 text-sm font-bold text-primary-600 transition hover:text-primary-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>

      {recoveryOpen ? (
        <div
          id="panel-recuperacion"
          className="mt-4 rounded-card border-2 border-navy-100 bg-navy-50 p-4"
        >
          <p className="mb-3 text-sm font-bold text-navy-700">Recuperar contraseña</p>

          {recoveryResult ? (
            <Alert tone="success">{recoveryResult}</Alert>
          ) : (
            <div>
              <Input
                ref={recoveryInputRef}
                label="Correo electrónico"
                name="recoveryEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="estudiante@aprendesammy.com"
                icon={<IconMail size={18} />}
                value={recoveryEmail}
                error={recoveryError}
                hint="Te enviaremos un enlace para crear una contraseña nueva. Pulsa Enter o el botón para enviarlo."
                onChange={(event) => {
                  setRecoveryEmail(event.target.value)
                  setRecoveryError(null)
                }}
                onBlur={() => setRecoveryEmail(normalizeEmail(recoveryEmail))}
                onKeyDown={(event) => {
                  // Enter envía el panel sin necesidad de un <form> propio.
                  if (event.key === 'Enter' && !recoverySending) {
                    event.preventDefault()
                    void handleRecovery()
                  }
                }}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={recoverySending}
                  icon={<IconRefresh size={16} />}
                  onClick={() => void handleRecovery()}
                >
                  {recoverySending ? 'Enviando…' : 'Enviar enlace'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={toggleRecovery}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={submitting}
        disabled={submitting}
        className="mt-6"
      >
        {submitting ? 'Entrando…' : 'Iniciar sesión'}
      </Button>

      {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
    </form>
  )
}
