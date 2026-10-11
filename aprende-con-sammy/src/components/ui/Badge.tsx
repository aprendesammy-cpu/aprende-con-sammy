import type { ReactNode } from 'react'

/**
 * Etiqueta corta de estado: roles, planes, indicadores en vivo.
 */

/** Tonos semánticos de la insignia. */
export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'navy'
  | 'sun'
  | 'coral'
  | 'creative'
  | 'success'
  | 'danger'

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  primary: 'bg-primary-50 text-primary-700 ring-primary-200',
  navy: 'bg-navy-50 text-navy-700 ring-navy-100',
  sun: 'bg-sun-50 text-sun-600 ring-sun-100',
  coral: 'bg-coral-50 text-coral-600 ring-coral-100',
  creative: 'bg-creative-50 text-creative-600 ring-creative-100',
  success: 'bg-success-50 text-success-600 ring-success-100',
  danger: 'bg-danger-50 text-danger-600 ring-danger-100',
} satisfies Record<BadgeTone, string>

/** Props de la insignia. */
export interface BadgeProps {
  tone?: BadgeTone
  /** Punto de estado animado (por ejemplo, "En sesión"). */
  pulse?: boolean
  /** Icono a la izquierda del texto. */
  icon?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * Insignia compacta.
 *
 * @param props Tono, icono y contenido.
 */
export function Badge({
  tone = 'neutral',
  pulse = false,
  icon,
  className = '',
  children,
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset whitespace-nowrap',
        TONES[tone],
        className,
      ].join(' ')}
    >
      {pulse ? (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      ) : null}
      {icon}
      {children}
    </span>
  )
}
