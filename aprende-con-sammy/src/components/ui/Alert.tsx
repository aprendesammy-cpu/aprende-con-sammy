import type { ReactNode } from 'react'

/**
 * Mensajes emergentes no bloqueantes: errores de formulario, confirmaciones
 * y avisos de configuración.
 */

/** Tonos semánticos del aviso. */
export type AlertTone = 'error' | 'success' | 'warning' | 'info'

const TONES = {
  error: {
    box: 'border-danger-100 bg-danger-50 text-danger-600',
    icon: 'text-danger-500',
  },
  success: {
    box: 'border-success-100 bg-success-50 text-success-600',
    icon: 'text-success-500',
  },
  warning: {
    box: 'border-sun-100 bg-sun-50 text-sun-600',
    icon: 'text-sun-500',
  },
  info: {
    box: 'border-navy-100 bg-navy-50 text-navy-700',
    icon: 'text-navy-500',
  },
} satisfies Record<AlertTone, { box: string; icon: string }>

/** Glifo por tono, sin dependencias externas. */
const GLYPHS: Record<AlertTone, string> = {
  error: '✕',
  success: '✓',
  warning: '!',
  info: 'i',
}

/** Props del aviso. */
export interface AlertProps {
  tone?: AlertTone
  /** Título opcional en negrita. */
  title?: ReactNode
  /** Permite cerrarlo manualmente. */
  onDismiss?: () => void
  /** Acción secundaria (por ejemplo, "Reintentar"). */
  action?: ReactNode
  className?: string
  children?: ReactNode
}

/**
 * Aviso contextual.
 *
 * `role="alert"` para errores (interrumpe al lector de pantalla) y
 * `role="status"` para el resto (se anuncia sin interrumpir).
 *
 * @param props Tono, título, acción y contenido.
 */
export function Alert({
  tone = 'info',
  title,
  onDismiss,
  action,
  className = '',
  children,
}: AlertProps) {
  const styles = TONES[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={[
        'flex items-start gap-3 rounded-card border-2 px-4 py-3 text-sm',
        styles.box,
        className,
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-black',
          styles.icon,
        ].join(' ')}
        aria-hidden="true"
      >
        {GLYPHS[tone]}
      </span>

      <div className="min-w-0 flex-1">
        {title ? <p className="font-extrabold">{title}</p> : null}
        {children ? (
          <div className={title ? 'mt-0.5 leading-relaxed opacity-90' : 'leading-relaxed'}>
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="-mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-70 transition hover:bg-white/70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <span aria-hidden="true">✕</span>
        </button>
      ) : null}
    </div>
  )
}
