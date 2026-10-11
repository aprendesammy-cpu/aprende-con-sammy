import { SammyMark } from '@/components/SammyMascot'

/**
 * ============================================================
 *  Pie de página oficial de "Aprende con Sammy"
 * ============================================================
 *  Incluye el slogan de marca en la tipografía decorativa Caveat,
 *  el sello circular de Sammy y el correo de contacto del brand guide.
 */

/** Frases rotatorias de aliento de la marca (Caveat). */
const ENCOURAGEMENTS = [
  '¡Tú puedes!',
  'Un paso a la vez.',
  'La práctica hace grandes avances.',
] as const

/** Props del pie de página. */
export interface AppFooterProps {
  /** Muestra solo la versión compacta (una línea). */
  compact?: boolean
  className?: string
}

/**
 * Sello circular de la marca: anillo teal→morado con la cara de Sammy.
 */
function SammySeal({ size = 56 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full border-4 border-primary-100 bg-gradient-to-br from-[#00B4A6] to-[#7B61FF] p-1 shadow-soft"
      style={{ width: size, height: size }}
    >
      <SammyMark size={size - 14} className="!bg-white/95" />
    </span>
  )
}

/**
 * Footer de la aplicación.
 *
 * @param props `compact` para la versión de una sola línea.
 */
export function AppFooter({ compact = false, className = '' }: AppFooterProps) {
  if (compact) {
    return (
      <footer
        className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-4 text-xs text-muted ${className}`}
      >
        <span className="font-script text-base leading-none text-creative-500">
          {ENCOURAGEMENTS[0]}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Contacto:{' '}
          <a
            href="mailto:aprendesammy@gmail.com"
            className="font-bold text-primary-600 underline-offset-2 hover:underline"
          >
            aprendesammy@gmail.com
          </a>
        </span>
      </footer>
    )
  }

  return (
    <footer
      className={`border-t-2 border-primary-100 bg-warmwhite px-4 py-8 md:px-8 ${className}`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
        {/* Sello + slogan */}
        <div className="flex items-center gap-4">
          <SammySeal size={58} />
          <div>
            <p className="font-head text-base font-extrabold text-navy-700">
              Aprende <span className="text-sun-400">con</span>{' '}
              <span className="text-gradient-sammy">Sammy</span>
            </p>
            {/* Slogan oficial — tipografía decorativa Caveat */}
            <p className="font-script mt-0.5 text-xl leading-none text-creative-500">
              Aprender también se aprende. <span className="text-coral-500">♥</span>
            </p>
          </div>
        </div>

        {/* Contacto + frases de aliento */}
        <div className="flex flex-col items-center gap-1.5 sm:items-end">
          <p className="text-sm font-semibold text-navy-700">
            Contacto:{' '}
            <a
              href="mailto:aprendesammy@gmail.com"
              className="font-bold text-primary-600 underline-offset-2 hover:underline"
            >
              aprendesammy@gmail.com
            </a>
          </p>
          <p className="font-script text-lg leading-none text-primary-600">
            {ENCOURAGEMENTS[1]}{' '}
            <span className="text-sky-500">{ENCOURAGEMENTS[2]}</span>
          </p>
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Aprende con Sammy · Aprende a tu manera. Avanza con Sammy.
          </p>
        </div>
      </div>
    </footer>
  )
}
