import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'

import { IconEye, IconEyeOff } from '@/components/icons'

/**
 * Campo de texto con etiqueta, icono, ayuda y error integrados.
 * Toda la cableado accesible (`htmlFor`, `aria-invalid`, `aria-describedby`)
 * se genera automáticamente, de modo que los formularios no puedan olvidarlo.
 */

/** Props del campo de texto. */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'ref'> {
  /** Etiqueta visible. Obligatoria: ningún campo queda sin nombre accesible. */
  label: string
  /** Mensaje de error. Su presencia marca el campo como inválido. */
  error?: string | null
  /** Texto de ayuda permanente bajo el campo. */
  hint?: string | null
  /** Icono a la izquierda del input. */
  icon?: ReactNode
  /** Muestra el conmutador de visibilidad en campos de contraseña. */
  passwordToggle?: boolean
  /** Ancho completo (por defecto). */
  fullWidth?: boolean
  ref?: Ref<HTMLInputElement>
}

/**
 * Input accesible con estados de error y ayuda.
 *
 * @param props Atributos nativos del input más las extensiones del sistema.
 */
export function Input({
  label,
  error,
  hint,
  icon,
  passwordToggle,
  fullWidth = true,
  id,
  type = 'text',
  className = '',
  disabled,
  required,
  ref,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`

  const isPassword = type === 'password'
  const canToggle = passwordToggle ?? isPassword
  const [revealed, setRevealed] = useState(false)

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={fullWidth ? 'w-full' : undefined}>
      <label
        htmlFor={inputId}
        className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-bold text-navy-700"
      >
        <span>
          {label}
          {required ? (
            <span className="ml-1 text-danger-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
      </label>

      <div className="relative">
        {icon ? (
          <span
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}

        <input
          id={inputId}
          ref={ref}
          type={canToggle && revealed ? 'text' : type}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'min-h-11 w-full rounded-xl border-2 bg-white px-3.5 py-2.5 text-[15px] text-ink',
            'transition-colors duration-150 placeholder:text-slate-400',
            'focus:outline-none focus:ring-4',
            icon ? 'pl-11' : '',
            canToggle ? 'pr-11' : '',
            error
              ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-100'
              : 'border-slate-200 hover:border-slate-300 focus:border-primary-400 focus:ring-primary-100',
            disabled ? 'cursor-not-allowed bg-slate-50 text-muted' : '',
            // Evita el zoom automático de iOS al enfocar (requiere >=16px)
            'text-base',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />

        {canToggle ? (
          <button
            type="button"
            onClick={() => setRevealed((previous) => !previous)}
            aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={revealed}
            className="absolute top-1/2 right-1.5 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            {revealed ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        ) : null}
      </div>

      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-danger-600"
        >
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      ) : null}
    </div>
  )
}
