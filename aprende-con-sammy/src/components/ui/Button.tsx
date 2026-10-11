import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

import { IconCheck } from '@/components/icons'

/**
 * Botón base del sistema de diseño.
 * Cinco variantes semánticas y tres tamaños. El tamaño `md` mide 44 px de alto,
 * el mínimo táctil recomendado por WCAG 2.5.5.
 */

/** Variantes visuales disponibles. */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

/** Tamaños disponibles. */
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS = {
  /* Primario oficial: #00B4A6 → hover #009688, texto blanco */
  primary:
    'bg-primary-500 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-100 disabled:text-primary-600',
  /* Secundario oficial: #FFCB3D → hover #FFB300, texto #1E2A44 */
  secondary:
    'bg-sun-400 text-navy-700 hover:bg-sun-500 active:bg-sun-600 disabled:bg-sun-100 disabled:text-sun-600',
  /* Terciario/outline oficial: borde y texto morado #7B61FF */
  outline:
    'border-2 border-creative-500 bg-white text-creative-500 hover:bg-creative-50 active:bg-creative-100 disabled:border-creative-100 disabled:text-muted',
  ghost:
    'bg-transparent text-navy-700 hover:bg-navy-50 active:bg-navy-100 disabled:text-muted',
  danger:
    'bg-danger-500 text-white hover:bg-danger-400 active:bg-danger-600 disabled:bg-danger-100 disabled:text-danger-400',
} satisfies Record<ButtonVariant, string>

const SIZES = {
  sm: 'h-9 min-w-9 px-3 text-sm gap-1.5 rounded-[10px]',
  md: 'h-11 min-w-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 min-w-13 px-6 text-base gap-2 rounded-xl2',
} satisfies Record<ButtonSize, string>

const BASE =
  'relative inline-flex select-none items-center justify-center font-semibold whitespace-nowrap ' +
  'transition-[background-color,color,border-color,box-shadow] duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ' +
  'disabled:cursor-not-allowed active:scale-[0.985] motion-reduce:active:scale-100'

/** Props del botón. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Ocupa todo el ancho disponible. */
  fullWidth?: boolean
  /** Muestra un spinner y bloquea la interacción. */
  loading?: boolean
  /** Muestra una marca de verificación (éxito). */
  success?: boolean
  /** Icono a la izquierda de la etiqueta. */
  icon?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

/**
 * Botón accesible con estados de carga y éxito.
 *
 * `type` por defecto es `"button"` (no `"submit"`) para evitar envíos
 * accidentales dentro de un formulario; el botón de envío lo declara explícito.
 *
 * @param props Variantes, estado y contenido.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  success = false,
  icon,
  type = 'button',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-variant={variant}
      className={[
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : success ? (
        <IconCheck size={size === 'sm' ? 14 : 16} className="shrink-0" />
      ) : (
        icon
      )}
      {children ? <span className="truncate">{children}</span> : null}
    </button>
  )
}
