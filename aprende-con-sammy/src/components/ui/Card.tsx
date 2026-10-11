import type { ElementType, ReactNode } from 'react'

/**
 * Tarjeta contenedora: superficie blanca, radio de 16 px y sombra suave,
 * según la guía de estilo del producto.
 */

/** Tonos de acento disponibles para la tarjeta. */
export type CardTone = 'default' | 'primary' | 'navy' | 'sun' | 'success' | 'danger'

const TONES = {
  default: 'border-primary-100 bg-white',
  primary: 'border-primary-100 bg-primary-50/60',
  navy: 'border-primary-100 bg-cream',
  sun: 'border-sun-100 bg-sun-50',
  success: 'border-success-100 bg-success-50',
  danger: 'border-danger-100 bg-danger-50',
} satisfies Record<CardTone, string>

/** Props de la tarjeta. */
export interface CardProps {
  /** Título visible en la cabecera. */
  title?: ReactNode
  /** Texto secundario bajo el título. */
  subtitle?: ReactNode
  /** Acción alineada a la derecha de la cabecera. */
  action?: ReactNode
  /** Icono mostrado junto al título. */
  icon?: ReactNode
  tone?: CardTone
  /** Elimina el relleno interno (para listas o imágenes a sangre). */
  flush?: boolean
  /** Etiqueta HTML o componente contenedor. Por defecto `section`. */
  as?: ElementType
  className?: string
  children?: ReactNode
}

/**
 * Tarjeta con cabecera opcional.
 *
 * @param props Contenido y opciones visuales.
 */
export function Card({
  title,
  subtitle,
  action,
  icon,
  tone = 'default',
  flush = false,
  as: Tag = 'section',
  className = '',
  children,
}: CardProps) {
  const hasHeader = Boolean(title || subtitle || action)

  return (
    <Tag
      className={[
        /* Cards del brand guide: radio 16 px, borde menta 2 px y sombra teal suave */
        'rounded-card border-2 shadow-card',
        TONES[tone],
        flush ? '' : 'p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasHeader ? (
        <header className={flush ? 'p-5 pb-0' : 'mb-4 flex items-start gap-3'}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {icon ? (
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-600">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2 className="truncate text-base font-extrabold text-navy-700 sm:text-lg">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      {children ? (
        <div className={flush && hasHeader ? 'p-5 pt-4' : undefined}>{children}</div>
      ) : null}
    </Tag>
  )
}
