import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react'

import { IconChevronDown } from '@/components/icons'

/**
 * Lista desplegable accesible con la misma anatomía visual que `Input`.
 */

/** Opción seleccionable. */
export interface SelectOption {
  value: string
  label: string
  /** Deshabilita la opción individualmente. */
  disabled?: boolean
}

/** Props del desplegable. */
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'ref'> {
  label: string
  options: SelectOption[]
  error?: string | null
  hint?: string | null
  icon?: ReactNode
  /** Texto de la opción neutra inicial. `null` la omite. */
  placeholder?: string | null
  fullWidth?: boolean
  ref?: Ref<HTMLSelectElement>
}

/**
 * Select accesible con etiqueta, ayuda y error.
 *
 * @param props Atributos nativos del select más las opciones.
 */
export function Select({
  label,
  options,
  error,
  hint,
  icon,
  placeholder = 'Selecciona una opción',
  fullWidth = true,
  id,
  className = '',
  disabled,
  required,
  ref,
  ...props
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const hintId = `${selectId}-hint`
  const errorId = `${selectId}-error`

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={fullWidth ? 'w-full' : undefined}>
      <label
        htmlFor={selectId}
        className="mb-1.5 block text-sm font-bold text-navy-700"
      >
        {label}
        {required ? (
          <span className="ml-1 text-danger-500" aria-hidden="true">
            *
          </span>
        ) : null}
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

        <select
          id={selectId}
          ref={ref}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'min-h-11 w-full appearance-none rounded-[10px] border-2 bg-white px-3.5 py-2.5',
            'text-base text-ink transition-colors duration-150',
            'focus:outline-none focus:ring-4',
            icon ? 'pl-11' : '',
            'pr-11',
            error
              ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-100'
              : 'border-primary-100 hover:border-primary-200 focus:border-primary-500 focus:ring-primary-100',
            disabled ? 'cursor-not-allowed bg-slate-50 text-muted' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {placeholder !== null ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        <span
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
          aria-hidden="true"
        >
          <IconChevronDown size={18} />
        </span>
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
