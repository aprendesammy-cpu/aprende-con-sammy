import { useEffect, useRef, useState, type FormEvent } from 'react'

import { IconBoard, IconLock, IconMail, IconUser } from '@/components/icons'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createUserManually } from '@/lib/users'
import { normalizeEmail } from '@/lib/utils'
import { USER_ROLE_LABELS } from '@/types'
import type { AdminCreateUserData, User, UserRole } from '@/types'

/**
 * Diálogo de alta manual de usuarios.
 *
 * Usa el elemento nativo `<dialog>` con `showModal()`: aporta foco atrapado,
 * cierre con Escape, capa `::backdrop` e `aria-modal` sin escribir ni una
 * línea de gestión de foco a mano.
 *
 * A diferencia del registro público, aquí SÍ puede asignarse el rol `admin`.
 */

const ALL_ROLES: UserRole[] = ['padre', 'educador', 'admin']

const ROLE_OPTIONS = ALL_ROLES.map((role) => ({
  value: role,
  label: USER_ROLE_LABELS[role],
}))

const INITIAL_VALUES: AdminCreateUserData & { sala: string } = {
  fullName: '',
  email: '',
  password: '',
  role: 'padre',
  sala: '',
}

/** Props del diálogo. */
export interface CreateUserDialogProps {
  open: boolean
  onClose: () => void
  /** Se invoca con el usuario creado para actualizar la lista. */
  onCreated: (user: User) => void
}

/**
 * Formulario modal de creación de usuarios.
 *
 * @param props Visibilidad y callbacks.
 */
export function CreateUserDialog({ open, onClose, onCreated }: CreateUserDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [values, setValues] = useState(INITIAL_VALUES)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  /**
   * Sincroniza el estado nativo del diálogo con la prop `open`.
   *
   * `showModal()` y `close()` pueden no existir (navegadores antiguos, entornos
   * de prueba). Sin esta comprobación el componente lanza un `TypeError` dentro
   * de un efecto y React desmonta el árbol completo: la aplicación entera se
   * queda en blanco por un modal. Se degrada a la propiedad `open`, que pierde
   * el foco atrapado y la capa de fondo pero mantiene el diálogo utilizable.
   */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    try {
      if (open) {
        if (typeof dialog.showModal === 'function' && !dialog.open) {
          dialog.showModal()
        } else {
          dialog.open = true
        }
      } else if (dialog.open) {
        if (typeof dialog.close === 'function') {
          dialog.close()
        } else {
          dialog.open = false
        }
      }
    } catch (error) {
      console.error('[CreateUserDialog] No se pudo sincronizar el diálogo:', error)
      dialog.open = open
    }
  }, [open])

  /**
   * Actualiza un campo.
   *
   * @param field Campo a modificar.
   * @param value Nuevo valor.
   */
  function update<K extends keyof typeof INITIAL_VALUES>(
    field: K,
    value: (typeof INITIAL_VALUES)[K],
  ) {
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrorMessage(null)
  }

  /**
   * Envía el alta a la Edge Function.
   *
   * @param event Evento de envío.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    try {
      const result = await createUserManually({
        fullName: values.fullName,
        email: normalizeEmail(values.email),
        password: values.password,
        role: values.role,
        ...(values.role === 'educador' ? { sala: values.sala.trim() } : {}),
      })

      if (!result.success || !result.data) {
        setErrorMessage(result.message)
        return
      }

      onCreated(result.data)
      setValues(INITIAL_VALUES)
      onClose()
    } catch (error) {
      console.error('[CreateUserDialog] Excepción inesperada:', error)
      setErrorMessage('No pudimos crear el usuario. Inténtalo de nuevo en unos momentos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="titulo-crear-usuario"
      onClose={onClose}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-card border-0 bg-white p-0 shadow-card backdrop:bg-navy-900/50 backdrop:backdrop-blur-sm"
    >
      <form
        method="dialog"
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4 p-6"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="titulo-crear-usuario" className="text-lg font-extrabold text-navy-700">
              Crear usuario manualmente
            </h2>
            <p className="mt-1 text-xs text-muted">
              La cuenta se activa de inmediato: no se envía correo de confirmación.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={submitting}
          >
            ✕
          </Button>
        </header>

        {errorMessage ? (
          <Alert tone="error" title="No se pudo crear el usuario">
            {errorMessage}
          </Alert>
        ) : null}

        <Input
          label="Nombre completo"
          name="adminFullName"
          autoComplete="off"
          placeholder="Marta González"
          required
          icon={<IconUser size={18} />}
          value={values.fullName}
          onChange={(event) => update('fullName', event.target.value)}
        />

        <Input
          label="Correo electrónico"
          name="adminEmail"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="marta@centro.cl"
          required
          icon={<IconMail size={18} />}
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          onBlur={() => update('email', normalizeEmail(values.email))}
        />

        <Input
          label="Contraseña provisional"
          name="adminPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          required
          icon={<IconLock size={18} />}
          value={values.password}
          hint="Comunícala por un canal seguro y pide que la cambie al entrar."
          onChange={(event) => update('password', event.target.value)}
        />

        <Select
          label="Rol"
          name="adminRole"
          required
          placeholder={null}
          options={ROLE_OPTIONS}
          value={values.role}
          onChange={(event) => update('role', event.target.value as UserRole)}
        />

        {values.role === 'educador' ? (
          <div className="rounded-card border-2 border-dashed border-creative-100 bg-creative-50/50 p-3.5">
            <Input
              label="Sala que lidera"
              name="adminSala"
              placeholder="Sala Arcoíris"
              required
              icon={<IconBoard size={18} />}
              value={values.sala}
              onChange={(event) => update('sala', event.target.value)}
            />
          </div>
        ) : null}

        <footer className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? 'Creando…' : 'Crear usuario'}
          </Button>
        </footer>
      </form>
    </dialog>
  )
}
