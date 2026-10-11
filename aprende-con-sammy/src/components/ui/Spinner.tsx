import type { ReactNode } from 'react'

/**
 * Indicador de carga accesible.
 * El texto va en `sr-only` para que un lector de pantalla lo anuncie,
 * mientras que el aro animado es puramente visual.
 */

/** Tamaños del spinner. */
export type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-7 w-7 border-[3px]',
  lg: 'h-11 w-11 border-4',
} satisfies Record<SpinnerSize, string>

/** Props del spinner. */
export interface SpinnerProps {
  size?: SpinnerSize
  /**
   * Texto para lectores de pantalla. Pasa `null` para que el aro sea
   * puramente decorativo (cuando ya hay un texto visible equivalente).
   */
  label?: string | null
  /** Color del aro (clase de Tailwind sobre `border-color`). */
  tone?: 'primary' | 'navy' | 'white'
  className?: string
}

/**
 * Aro de carga animado.
 *
 * @param props Tamaño, tono y etiqueta accesible.
 */
export function Spinner({
  size = 'md',
  label = 'Cargando',
  tone = 'primary',
  className = '',
}: SpinnerProps) {
  const toneClass =
    tone === 'white'
      ? 'border-white/40 border-t-white'
      : tone === 'navy'
        ? 'border-navy-200 border-t-navy-700'
        : 'border-primary-200 border-t-primary-500'

  const ring = (
    <span
      className={[
        'inline-block animate-spin rounded-full',
        SIZES[size],
        toneClass,
        'motion-reduce:animate-none',
      ].join(' ')}
      aria-hidden="true"
    />
  )

  // Modo decorativo: sin región viva propia, para no duplicar el anuncio
  // cuando el componente contenedor ya muestra el mismo mensaje.
  if (label === null) {
    return (
      <span className={['inline-flex items-center gap-2', className].filter(Boolean).join(' ')}>
        {ring}
      </span>
    )
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={['inline-flex items-center gap-2', className].filter(Boolean).join(' ')}
    >
      {ring}
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Props de la pantalla de carga completa. */
export interface FullPageLoaderProps {
  /** Mensaje visible bajo el spinner. */
  message?: ReactNode
}

/**
 * Ocupa el viewport completo mientras se resuelve la sesión.
 *
 * @param props Mensaje opcional.
 */
export function FullPageLoader({ message = 'Cargando Aprende con Sammy…' }: FullPageLoaderProps) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      {/* Una única región viva: el aro es decorativo y el <p> visible es el
          texto anunciado. Antes se anunciaba el mismo mensaje dos veces. */}
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4 text-center"
      >
        <Spinner size="lg" label={null} />
        <p className="text-sm font-semibold text-muted">{message}</p>
      </div>
    </div>
  )
}
