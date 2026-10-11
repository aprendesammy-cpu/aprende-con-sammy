import type { ReactNode } from 'react'

/**
 * Barra de progreso accesible para competencias, fuerza de contraseña
 * y descarga de recursos.
 */

/** Tonos de la barra. */
export type ProgressTone = 'primary' | 'navy' | 'sun' | 'coral' | 'creative' | 'success' | 'danger'

const TONES = {
  primary: 'bg-primary-400',
  navy: 'bg-navy-700',
  sun: 'bg-sun-400',
  coral: 'bg-coral-500',
  creative: 'bg-creative-500',
  success: 'bg-success-500',
  danger: 'bg-danger-500',
} satisfies Record<ProgressTone, string>

const HEIGHTS = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
} satisfies Record<'sm' | 'md' | 'lg', string>

/** Props de la barra de progreso. */
export interface ProgressBarProps {
  /** Valor actual, entre 0 y 100. */
  value: number
  /** Valor máximo si la escala no es porcentual. */
  max?: number
  /** Etiqueta visible a la izquierda. */
  label?: ReactNode
  /** Texto a la derecha (por defecto el porcentaje). Pasa `null` para ocultarlo. */
  valueLabel?: ReactNode | null
  tone?: ProgressTone
  size?: 'sm' | 'md' | 'lg'
  /** Muestra rayas animadas para progreso indeterminado. */
  striped?: boolean
  className?: string
}

/**
 * Barra de progreso con `role="progressbar"` y atributos ARIA completos.
 *
 * @param props Valor, escala y apariencia.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueLabel,
  tone = 'primary',
  size = 'md',
  striped = false,
  className = '',
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100
  // Se recorta el valor al rango válido: un dato corrupto de la BD no debe
  // desbordar la barra ni producir un ARIA inválido.
  const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), safeMax)
  const percent = Math.round((clamped / safeMax) * 100)

  const showValueLabel = valueLabel === undefined ? `${percent}%` : valueLabel

  return (
    <div className={className}>
      {label || showValueLabel ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label ? (
            <span className="text-sm font-bold text-navy-700">{label}</span>
          ) : (
            <span />
          )}
          {showValueLabel ? (
            <span className="text-xs font-bold text-muted tabular-nums">{showValueLabel}</span>
          ) : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={typeof label === 'string' ? label : undefined}
        className={['w-full overflow-hidden rounded-full bg-slate-200/80', HEIGHTS[size]].join(' ')}
      >
        <div
          className={[
            'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
            TONES[tone],
            striped
              ? 'bg-[linear-gradient(135deg,rgba(255,255,255,.35)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.35)_50%,rgba(255,255,255,.35)_75%,transparent_75%)] bg-[length:1rem_1rem]'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
