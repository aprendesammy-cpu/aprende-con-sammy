import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { IconBoard, IconLock, IconMail, IconUser } from '@/components/icons'
import { SammyMascot } from '@/components/SammyMascot'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/hooks/useAuth'
import { normalizeEmail } from '@/lib/utils'
import {
  evaluatePasswordStrength,
  firstErrorKey,
  hasErrors,
  validateRegisterForm,
  type FieldErrors,
} from '@/lib/validation'
import {
  isPublicRegisterRole,
  PUBLIC_REGISTER_ROLES,
  USER_ROLE_LABELS,
  type AuthResult,
  type RegisterFormValues,
} from '@/types'

/**
 * ============================================================
 *  Formulario de registro
 * ============================================================
 *  Campos: nombre completo, email, contraseña y rol.
 *  Si el rol es «Educador» aparece el campo adicional «Sala que lideras».
 *
 *  Los errores se DERIVAN de los valores (no se guardan en estado), lo que
 *  elimina cualquier desincronización entre lo que se muestra y lo que se
 *  validaría al enviar.
 */

/** Orden visual de los campos, para mover el foco al primer error. */
const FIELD_ORDER: (keyof RegisterFormValues)[] = [
  'fullName',
  'email',
  'password',
  'role',
  'sala',
]

const ROLE_OPTIONS = PUBLIC_REGISTER_ROLES.map((role) => ({
  value: role,
  label: USER_ROLE_LABELS[role],
}))

/** Valores iniciales del formulario. */
const INITIAL_VALUES: RegisterFormValues = {
  fullName: '',
  email: '',
  password: '',
  role: '',
  sala: '',
}

/** Props del formulario de registro. */
export interface RegisterFormProps {
  /** Se invoca cuando el registro crea una sesión activa. */
  onSuccess?: (result: AuthResult) => void
  /** Contenido bajo el botón (por ejemplo, el enlace a Iniciar sesión). */
  footer?: ReactNode
  className?: string
}

/**
 * Formulario de alta de usuarios.
 *
 * @param props Callbacks de éxito y contenido adicional.
 */
export function RegisterForm({ onSuccess, footer, className = '' }: RegisterFormProps) {
  const { register } = useAuth()

  const [values, setValues] = useState<RegisterFormValues>(INITIAL_VALUES)
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterFormValues, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)

  const fieldRefs = useRef<{ [K in keyof RegisterFormValues]?: HTMLElement | null }>({})

  /** Errores completos, recalculados ante cualquier cambio. */
  const allErrors = useMemo(() => validateRegisterForm(values), [values])

  /**
   * Errores visibles: todos tras un intento de envío, solo los de campos
   * ya visitados mientras se escribe (para no regañar antes de tiempo).
   */
  const visibleErrors = useMemo<FieldErrors<RegisterFormValues>>(() => {
    if (submitted) return allErrors
    const filtered: FieldErrors<RegisterFormValues> = {}
    for (const key of FIELD_ORDER) {
      if (touched[key] && allErrors[key]) {
        filtered[key] = allErrors[key]
      }
    }
    return filtered
  }, [submitted, allErrors, touched])

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(values.password),
    [values.password],
  )
  const isEducator = values.role === 'educador'

  /**
   * Actualiza un campo y limpia el resultado anterior del servidor.
   *
   * @param field Campo a actualizar.
   * @param value Nuevo valor.
   */
  function update<K extends keyof RegisterFormValues>(field: K, value: RegisterFormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: value }))
    setResult(null)
  }

  /**
   * Marca un campo como visitado y muestra su error si lo tiene.
   *
   * @param field Campo abandonado.
   */
  function handleBlur(field: keyof RegisterFormValues) {
    setTouched((previous) => ({ ...previous, [field]: true }))
  }

  /**
   * Envía el formulario: valida, mueve el foco al primer error y registra.
   *
   * @param event Evento de envío.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSubmitted(true)
    setResult(null)

    const currentErrors = validateRegisterForm(values)
    if (hasErrors(currentErrors)) {
      const firstKey = firstErrorKey(currentErrors, FIELD_ORDER)
      if (firstKey) {
        fieldRefs.current[firstKey]?.focus()
      }
      return
    }

    // Tras validar, `role` es forzosamente un rol público registrable.
    if (!isPublicRegisterRole(values.role)) {
      return
    }

    setSubmitting(true)
    try {
      const authResult = await register({
        fullName: values.fullName,
        email: normalizeEmail(values.email),
        password: values.password,
        role: values.role,
        ...(values.role === 'educador' ? { sala: values.sala.trim() } : {}),
      })

      setResult(authResult)

      if (authResult.success && !authResult.requiresConfirmation) {
        onSuccess?.(authResult)
      }
    } catch (error) {
      console.error('[RegisterForm] Excepción inesperada al registrar:', error)
      setResult({
        success: false,
        message: 'No pudimos crear tu cuenta. Inténtalo de nuevo en unos momentos.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Registro completado pero pendiente de confirmar el email ──────────
  if (result?.success && result.requiresConfirmation) {
    return (
      <div className={['text-center', className].filter(Boolean).join(' ')}>
        <SammyMascot variant="celebrating" size={150} className="mx-auto mb-4" />
        <h2 className="text-2xl font-extrabold text-navy-700">¡Casi listo!</h2>
        <Alert tone="success" className="mt-4 text-left" title="Revisa tu correo">
          {result.message}
        </Alert>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className={className}>
      {result && !result.success ? (
        <Alert tone="error" className="mb-5" title="No pudimos crear tu cuenta">
          {result.message}
        </Alert>
      ) : null}

      {result?.success && !result.requiresConfirmation ? (
        <Alert tone="success" className="mb-5">
          {result.message}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        <Input
          ref={(element) => {
            fieldRefs.current.fullName = element
          }}
          label="Nombre completo"
          name="fullName"
          autoComplete="name"
          placeholder="Ana María Torres"
          required
          icon={<IconUser size={18} />}
          value={values.fullName}
          error={visibleErrors.fullName}
          onChange={(event) => update('fullName', event.target.value)}
          onBlur={() => handleBlur('fullName')}
        />

        <Input
          ref={(element) => {
            fieldRefs.current.email = element
          }}
          label="Correo electrónico"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ana@ejemplo.com"
          required
          icon={<IconMail size={18} />}
          value={values.email}
          error={visibleErrors.email}
          hint="Usa el email con el que te contacta el centro educativo."
          onChange={(event) => update('email', event.target.value)}
          onBlur={(event) => {
            // Se normaliza al salir del campo para que el usuario vea
            // exactamente qué dirección quedará registrada.
            update('email', normalizeEmail(event.target.value))
            handleBlur('email')
          }}
        />

        <div>
          <Input
            ref={(element) => {
              fieldRefs.current.password = element
            }}
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            required
            icon={<IconLock size={18} />}
            value={values.password}
            error={visibleErrors.password}
            onChange={(event) => update('password', event.target.value)}
            onBlur={() => handleBlur('password')}
          />

          {values.password ? (
            <ProgressBar
              className="mt-2.5"
              size="sm"
              value={passwordStrength.score}
              max={4}
              tone={passwordStrength.tone}
              label={null}
              valueLabel={`Seguridad: ${passwordStrength.label}`}
            />
          ) : null}
        </div>

        <Select
          ref={(element) => {
            fieldRefs.current.role = element
          }}
          label="¿Cuál es tu rol?"
          name="role"
          required
          icon={<IconUser size={18} />}
          placeholder="Selecciona una opción"
          options={ROLE_OPTIONS}
          value={values.role}
          error={visibleErrors.role}
          onChange={(event) => update('role', event.target.value as RegisterFormValues['role'])}
          onBlur={() => handleBlur('role')}
        />

        {/* Campo condicional: solo para educadores */}
        {isEducator ? (
          <div className="rounded-card border-2 border-dashed border-creative-100 bg-creative-50/50 p-3.5">
            <Input
              ref={(element) => {
                fieldRefs.current.sala = element
              }}
              label="Sala que lideras"
              name="sala"
              placeholder="Sala Arcoíris"
              required
              icon={<IconBoard size={18} />}
              value={values.sala}
              error={visibleErrors.sala}
              hint="La usaremos para vincular a las familias de tu sala."
              onChange={(event) => update('sala', event.target.value)}
              onBlur={() => handleBlur('sala')}
            />
          </div>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={submitting}
        className="mt-6"
        disabled={submitting}
      >
        {submitting ? 'Creando tu cuenta…' : 'Crear cuenta'}
      </Button>

      {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
    </form>
  )
}
