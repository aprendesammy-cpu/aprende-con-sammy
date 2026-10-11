import type { ReactNode } from 'react'

import { SammyMascot, type SammyVariant } from '@/components/SammyMascot'
import { Button } from '@/components/ui/Button'

/**
 * Estado vacío reutilizable.
 *
 * Las secciones cuya tabla aún no existe (Paso 6) usan este componente en vez
 * de datos falsos: una pantalla con cifras inventadas se confunde con una
 * pantalla rota, y ninguna de las dos comunica qué falta.
 */

/** Props del estado vacío. */
export interface EmptyStateProps {
  /** Título corto. */
  title: string
  /** Explicación de qué se mostrará aquí y de qué depende. */
  description: ReactNode
  variant?: SammyVariant
  /** Acción principal opcional. */
  actionLabel?: string
  onAction?: () => void
  /** Elementos adicionales (lista de requisitos, enlace…). */
  children?: ReactNode
  className?: string
}

/**
 * Pantalla de estado vacío con la mascota.
 *
 * @param props Título, descripción y acción opcional.
 */
export function EmptyState({
  title,
  description,
  variant = 'sitting',
  actionLabel,
  onAction,
  children,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center rounded-card border-2 border-dashed border-slate-200 bg-white/70 px-6 py-12 text-center',
        className,
      ].join(' ')}
    >
      <SammyMascot variant={variant} size={120} />

      <h2 className="mt-4 text-xl font-extrabold text-navy-700">{title}</h2>
      <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</div>

      {children ? <div className="mt-5 w-full max-w-md">{children}</div> : null}

      {actionLabel && onAction ? (
        <Button variant="outline" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
